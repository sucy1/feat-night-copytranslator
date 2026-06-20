import { batchStore } from "./batchStore";
import { BatchParagraph, BatchStatus } from "./types";
import eventBus from "@/common/event-bus";
import logger from "@/common/logger";
import { TranslateResult } from "@/common/translate/types";
import { Language } from "@/common/translate/types";
import { clipboard } from "electron";

type TranslateOptions = {
  engine?: string;
  from?: Language;
  to?: Language;
};

class BatchService {
  private pendingRequests: Map<
    string,
    { resolve: (res: TranslateResult) => void; reject: (err: any) => void }
  > = new Map();

  private clipboardWatcher: number | null = null;
  private lastClipboardText: string = "";
  private isListeningClipboard: boolean = false;

  constructor() {
    this.bindEventListeners();
  }

  private bindEventListeners(): void {
    eventBus.on("testTranslateResult", ({ id, data }: { id: string; data: TranslateResult }) => {
      const pending = this.pendingRequests.get(id);
      if (pending) {
        pending.resolve(data);
        this.pendingRequests.delete(id);
      }
    });

    eventBus.on("testTranslateError", ({ id, error }: { id: string; error: string }) => {
      const pending = this.pendingRequests.get(id);
      if (pending) {
        pending.reject(new Error(error));
        this.pendingRequests.delete(id);
      }
    });
  }

  startClipboardListener(): void {
    if (this.isListeningClipboard) return;
    this.isListeningClipboard = true;
    this.lastClipboardText = clipboard.readText() || "";

    this.clipboardWatcher = window.setInterval(() => {
      try {
        const currentText = clipboard.readText();
        if (currentText && currentText !== this.lastClipboardText) {
          const trimmed = currentText.trim();
          if (trimmed && trimmed.length > 0) {
            const state = batchStore.getState();
            const exists = state.paragraphs.some((p) => p.original === trimmed);
            if (!exists) {
              batchStore.addParagraph(trimmed);
              logger.toast("已添加到批量列表");
            }
          }
          this.lastClipboardText = currentText;
        }
      } catch (e) {
        logger.error("Clipboard watcher error:", e);
      }
    }, 800);
  }

  stopClipboardListener(): void {
    if (this.clipboardWatcher) {
      clearInterval(this.clipboardWatcher);
      this.clipboardWatcher = null;
    }
    this.isListeningClipboard = false;
  }

  toggleClipboardListener(): boolean {
    if (this.isListeningClipboard) {
      this.stopClipboardListener();
      return false;
    } else {
      this.startClipboardListener();
      return true;
    }
  }

  get clipboardListening(): boolean {
    return this.isListeningClipboard;
  }

  splitAndAddParagraphs(text: string): number {
    const paragraphs = text
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    let addedCount = 0;
    paragraphs.forEach((para) => {
      const state = batchStore.getState();
      const exists = state.paragraphs.some((p) => p.original === para);
      if (!exists) {
        batchStore.addParagraph(para);
        addedCount++;
      }
    });

    if (addedCount > 0) {
      logger.toast(`已添加 ${addedCount} 段文本`);
    }
    return addedCount;
  }

  private async translateSingle(
    text: string,
    options: TranslateOptions = {}
  ): Promise<TranslateResult> {
    const requestId = `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const engine = options.engine || "google";
    const from = options.from || "auto";
    const to = options.to || "zh-CN";

    return new Promise<TranslateResult>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error("Translation timeout"));
      }, 30000);

      const wrappedResolve = (res: TranslateResult) => {
        clearTimeout(timeout);
        this.pendingRequests.delete(requestId);
        resolve(res);
      };

      const wrappedReject = (err: any) => {
        clearTimeout(timeout);
        this.pendingRequests.delete(requestId);
        reject(err);
      };

      this.pendingRequests.set(requestId, { resolve: wrappedResolve, reject: wrappedReject });

      try {
        eventBus.at("dispatch", "testTranslate", {
          id: requestId,
          text,
          engine,
          from,
          to,
        });
      } catch (e) {
        this.pendingRequests.delete(requestId);
        clearTimeout(timeout);
        reject(e);
      }
    });
  }

  public async translateParagraph(
    paragraph: BatchParagraph,
    options: TranslateOptions = {}
  ): Promise<void> {
    batchStore.updateParagraph(paragraph.id, { status: "translating" });

    try {
      const result = await this.translateSingle(paragraph.original, options);
      batchStore.updateParagraph(paragraph.id, {
        status: "completed",
        translation: result.translation,
        from: result.from,
        to: result.to,
        engine: result.engine,
      });
    } catch (error) {
      logger.error(`Batch translate failed for paragraph ${paragraph.index}:`, error);
      batchStore.updateParagraph(paragraph.id, {
        status: "error",
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }

  public async translateAll(
    options: TranslateOptions = {},
    concurrency: number = 2
  ): Promise<void> {
    const state = batchStore.getState();
    const pendingParagraphs = state.paragraphs.filter(
      (p) => p.status === "idle" || p.status === "error"
    );

    if (pendingParagraphs.length === 0) {
      logger.toast("没有待翻译的段落");
      return;
    }

    batchStore.setGlobalStatus("translating");

    let hasError = false;
    let completedCount = 0;

    for (let i = 0; i < pendingParagraphs.length; i += concurrency) {
      const chunk = pendingParagraphs.slice(i, i + concurrency);
      const promises = chunk.map((p) =>
        this.translateParagraph(p, options)
          .then(() => {
            completedCount++;
          })
          .catch(() => {
            hasError = true;
          })
      );
      await Promise.all(promises);
    }

    const finalState = batchStore.getState();
    const allCompleted = finalState.paragraphs.every(
      (p) => p.status === "completed"
    );

    batchStore.setGlobalStatus(allCompleted ? "completed" : "error");

    if (allCompleted) {
      logger.toast(`批量翻译完成，共 ${finalState.paragraphs.length} 段`);
    } else if (hasError) {
      const errorCount = finalState.paragraphs.filter((p) => p.status === "error").length;
      logger.toast(`翻译完成，${errorCount} 段失败`);
    }
  }

  public retryFailed(): Promise<void> {
    const state = batchStore.getState();
    const failed = state.paragraphs.filter((p) => p.status === "error");
    if (failed.length === 0) {
      logger.toast("没有失败的段落");
      return Promise.resolve();
    }
    return this.translateAll();
  }

  public getCompletedCount(): number {
    return batchStore
      .getState()
      .paragraphs.filter((p) => p.status === "completed").length;
  }

  public getPendingCount(): number {
    return batchStore
      .getState()
      .paragraphs.filter((p) => p.status === "idle" || p.status === "translating")
      .length;
  }

  public getErrorCount(): number {
    return batchStore
      .getState()
      .paragraphs.filter((p) => p.status === "error").length;
  }

  public copyAllTranslations(): string {
    const translated = batchStore
      .getState()
      .paragraphs.filter((p) => p.status === "completed" && p.translation);

    if (translated.length === 0) {
      return "";
    }

    const text = translated
      .map((p) => p.translation)
      .join("\n\n");

    clipboard.writeText(text);
    logger.toast(`已复制 ${translated.length} 段译文`);
    return text;
  }
}

export const batchService = new BatchService();
