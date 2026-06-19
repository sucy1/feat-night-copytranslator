import { batchStore } from "./batchStore";
import { BatchParagraph, BatchStatus } from "./types";
import eventBus from "@/common/event-bus";
import logger from "@/common/logger";
import { TranslateResult } from "@/common/translate/types";
import { getTranslator } from "@/common/translate/translators";
import { Language } from "@/common/translate/types";

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

  private async translateSingle(
    text: string,
    options: TranslateOptions = {}
  ): Promise<TranslateResult> {
    const requestId = `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const engine = options.engine || "google";
    const from = options.from || "auto";
    const to = options.to || "zh-CN";

    return new Promise<TranslateResult>((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject });

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error("Translation timeout"));
      }, 30000);

      const originalResolve = resolve;
      const wrappedResolve = (res: TranslateResult) => {
        clearTimeout(timeout);
        originalResolve(res);
      };
      this.pendingRequests.set(requestId, { resolve: wrappedResolve, reject });

      try {
        eventBus.at("dispatch", "testTranslate", {
          id: requestId,
          text,
          engine,
          from,
          to,
        });
      } catch (e) {
        clearTimeout(timeout);
        this.pendingRequests.delete(requestId);
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
    pendingParagraphs.forEach((p) =>
      batchStore.updateParagraph(p.id, { status: "translating" })
    );

    let hasError = false;

    for (let i = 0; i < pendingParagraphs.length; i += concurrency) {
      const chunk = pendingParagraphs.slice(i, i + concurrency);
      const promises = chunk.map((p) =>
        this.translateParagraph(p, options).catch(() => {
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
      logger.toast("部分段落翻译失败");
    }
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
}

export const batchService = new BatchService();
