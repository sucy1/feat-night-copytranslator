<template>
  <div class="batch-list-container">
    <v-toolbar flat dense color="transparent" class="batch-list-toolbar">
      <v-toolbar-title class="batch-list-title">
        <v-icon small class="mr-1">mdi-format-list-bulleted</v-icon>
        待翻译列表 ({{ paragraphs.length }})
      </v-toolbar-title>
      <v-spacer></v-spacer>
      <v-btn
        icon
        x-small
        :color="clipboardListening ? 'success' : ''"
        :active="clipboardListening"
        @click="toggleClipboard"
        :title="clipboardListening ? '关闭剪贴板监听' : '开启剪贴板监听，复制即添加'"
      >
        <v-icon small>{{ clipboardListening ? 'mdi-clipboard-check' : 'mdi-clipboard-outline' }}</v-icon>
      </v-btn>
      <v-btn
        text
        small
        :disabled="paragraphs.length === 0 || isTranslating"
        @click="clearAll"
      >
        <v-icon small>mdi-delete-sweep</v-icon>
        清空
      </v-btn>
    </v-toolbar>

    <div class="input-area">
      <v-textarea
        v-model="newParagraphText"
        dense
        flat
        solo
        hide-details
        placeholder="输入或粘贴文本...&#10;支持多段落，按空行自动拆分"
        prepend-inner-icon="mdi-plus"
        class="batch-textarea"
        rows="3"
        :disabled="isTranslating"
        @keydown.enter.ctrl="handleAddInput"
      ></v-textarea>
      <div class="input-actions">
        <v-btn
          small
          text
          @click="handleSplitAndAdd"
          :disabled="!newParagraphText.trim() || isTranslating"
        >
          <v-icon x-small left>mdi-text-box-multiple</v-icon>
          按空行拆分添加
        </v-btn>
        <v-btn
          small
          color="primary"
          depressed
          @click="handleAddInput"
          :disabled="!newParagraphText.trim() || isTranslating"
        >
          <v-icon x-small left>mdi-plus</v-icon>
          添加
        </v-btn>
        <v-btn
          small
          text
          @click="pasteFromClipboard"
          :disabled="isTranslating"
        >
          <v-icon x-small left>mdi-content-paste</v-icon>
          粘贴
        </v-btn>
      </div>
    </div>

    <div v-if="clipboardListening" class="clipboard-hint">
      <v-icon x-small color="success" class="mr-1">mdi-check-circle</v-icon>
      <span class="caption">剪贴板监听已开启，复制文本自动添加</span>
    </div>

    <div class="batch-list-scroll">
      <v-list dense flat class="batch-list" v-if="paragraphs.length > 0">
        <v-list-item
          v-for="para in paragraphs"
          :key="para.id"
          class="batch-list-item"
          :class="{
            'item-translating': para.status === 'translating',
            'item-completed': para.status === 'completed',
            'item-error': para.status === 'error',
          }"
        >
          <v-list-item-avatar class="index-avatar" size="28">
            <span class="index-text">{{ para.index }}</span>
          </v-list-item-avatar>

          <v-list-item-content class="item-content">
            <v-list-item-title class="item-title">
              <span class="preview-text" :title="para.original">
                {{ truncateText(para.original, 120) }}
              </span>
            </v-list-item-title>
            <v-list-item-subtitle class="item-subtitle">
              <template v-if="para.status === 'error'">
                <v-icon x-small color="error">mdi-alert</v-icon>
                {{ para.errorMessage || "翻译失败" }}
              </template>
              <template v-else-if="para.status === 'completed'">
                <v-icon x-small color="success">mdi-check-circle</v-icon>
                已翻译 · {{ para.engine || "unknown" }}
              </template>
              <template v-else-if="para.status === 'translating'">
                <v-progress-circular
                  indeterminate
                  color="primary"
                  :size="12"
                  :width="2"
                  class="mr-1"
                ></v-progress-circular>
                翻译中...
              </template>
              <template v-else>
                <v-icon x-small color="grey lighten-1">mdi-clock-outline</v-icon>
                等待翻译
              </template>
            </v-list-item-subtitle>
          </v-list-item-content>

          <v-list-item-action>
            <v-btn
              icon
              x-small
              :disabled="isTranslating || para.index === 1"
              @click="moveUp(para.id)"
            >
              <v-icon x-small>mdi-arrow-up</v-icon>
            </v-btn>
            <v-btn
              icon
              x-small
              :disabled="isTranslating || para.index === paragraphs.length"
              @click="moveDown(para.id)"
            >
              <v-icon x-small>mdi-arrow-down</v-icon>
            </v-btn>
            <v-btn
              icon
              x-small
              :disabled="isTranslating"
              color="error"
              @click="removeParagraph(para.id)"
            >
              <v-icon x-small>mdi-close</v-icon>
            </v-btn>
          </v-list-item-action>
        </v-list-item>
      </v-list>

      <div v-else class="empty-state">
        <v-icon large color="grey lighten-1">mdi-text-box-multiple-outline</v-icon>
        <p class="grey--text">暂无待翻译段落</p>
        <p class="caption grey--text">粘贴文本或开启剪贴板监听自动添加</p>
      </div>
    </div>

    <div class="batch-list-footer">
      <div class="stats-row">
        <v-chip small outlined class="stat-chip">
          <v-icon left x-small>mdi-clock-outline</v-icon>
          待翻译 {{ pendingCount }}
        </v-chip>
        <v-chip small color="success" outlined class="stat-chip">
          <v-icon left x-small>mdi-check</v-icon>
          完成 {{ completedCount }}
        </v-chip>
        <v-chip
          v-if="errorCount > 0"
          small
          color="error"
          outlined
          class="stat-chip"
        >
          <v-icon left x-small>mdi-alert</v-icon>
          失败 {{ errorCount }}
        </v-chip>
      </div>
      <div class="actions-row">
        <v-btn
          v-if="errorCount > 0"
          outlined
          color="warning"
          small
          :disabled="isTranslating"
          @click="handleRetry"
        >
          <v-icon x-small left>mdi-refresh</v-icon>
          重试失败
        </v-btn>
        <v-spacer></v-spacer>
        <v-btn
          color="primary"
          depressed
          :disabled="pendingCount === 0 || isTranslating"
          :loading="isTranslating"
          @click="handleTranslate"
        >
          <v-icon left>mdi-translate</v-icon>
          {{ isTranslating ? "翻译中..." : `批量翻译 (${pendingCount})` }}
        </v-btn>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Mixins } from "vue-property-decorator";
import BaseView from "@/components/BaseView.vue";
import { batchStore } from "./batchStore";
import { batchService } from "./batchService";
import { truncateText } from "./types";
import { BatchParagraph } from "./types";
import { clipboard } from "electron";

@Component
export default class BatchList extends Mixins(BaseView) {
  newParagraphText: string = "";
  unsubscribe: (() => void) | null = null;
  localClipboardListening: boolean = false;

  get paragraphs(): BatchParagraph[] {
    return batchStore.getState().paragraphs;
  }

  get isTranslating(): boolean {
    return batchStore.getState().globalStatus === "translating";
  }

  get clipboardListening(): boolean {
    return batchService.clipboardListening;
  }

  get pendingCount(): number {
    return batchService.getPendingCount();
  }

  get completedCount(): number {
    return batchService.getCompletedCount();
  }

  get errorCount(): number {
    return batchService.getErrorCount();
  }

  truncateText(text: string, max: number): string {
    return truncateText(text, max);
  }

  toggleClipboard(): void {
    const enabled = batchService.toggleClipboardListener();
    this.localClipboardListening = enabled;
    this.$forceUpdate();
  }

  pasteFromClipboard(): void {
    const text = clipboard.readText();
    if (text) {
      this.newParagraphText = text;
    }
  }

  handleAddInput(): void {
    const text = this.newParagraphText.trim();
    if (!text) return;
    batchStore.addParagraph(text);
    this.newParagraphText = "";
  }

  handleSplitAndAdd(): void {
    const text = this.newParagraphText.trim();
    if (!text) return;
    const count = batchService.splitAndAddParagraphs(text);
    if (count > 0) {
      this.newParagraphText = "";
    }
  }

  removeParagraph(id: string): void {
    batchStore.removeParagraph(id);
  }

  clearAll(): void {
    batchStore.clearParagraphs();
  }

  moveUp(id: string): void {
    const paras = [...this.paragraphs];
    const idx = paras.findIndex((p) => p.id === id);
    if (idx > 0) {
      [paras[idx - 1], paras[idx]] = [paras[idx], paras[idx - 1]];
      batchStore.reorderParagraphs(paras);
    }
  }

  moveDown(id: string): void {
    const paras = [...this.paragraphs];
    const idx = paras.findIndex((p) => p.id === id);
    if (idx >= 0 && idx < paras.length - 1) {
      [paras[idx], paras[idx + 1]] = [paras[idx + 1], paras[idx]];
      batchStore.reorderParagraphs(paras);
    }
  }

  async handleTranslate(): Promise<void> {
    await batchService.translateAll();
  }

  async handleRetry(): Promise<void> {
    await batchService.retryFailed();
  }

  mounted(): void {
    this.unsubscribe = batchStore.subscribe(() => {
      this.$forceUpdate();
    });
  }

  beforeDestroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
    if (batchService.clipboardListening) {
      batchService.stopClipboardListener();
    }
  }
}
</script>

<style scoped>
.batch-list-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.batch-list-toolbar {
  min-height: 40px;
  padding: 0 8px;
  flex-shrink: 0;
}

.batch-list-title {
  font-size: 14px;
  font-weight: 600;
}

.input-area {
  padding: 0 8px 8px;
  flex-shrink: 0;
}

.batch-textarea {
  margin-bottom: 4px;
}

.batch-textarea >>> .v-input__slot {
  border-radius: 6px;
  padding: 8px;
}

.batch-textarea >>> textarea {
  font-size: 13px;
}

.input-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

.clipboard-hint {
  display: flex;
  align-items: center;
  padding: 4px 12px;
  background: rgba(76, 175, 80, 0.08);
  color: #2e7d32;
  flex-shrink: 0;
}

.clipboard-hint .caption {
  font-size: 11px;
}

.batch-list-scroll {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

.batch-list {
  padding: 4px 0;
}

.batch-list-item {
  padding: 6px 8px;
  min-height: 52px;
  border-radius: 6px;
  margin: 2px 6px;
  transition: background-color 0.2s;
}

.batch-list-item:hover {
  background-color: rgba(0, 0, 0, 0.04);
}

.item-translating {
  background-color: rgba(33, 150, 243, 0.06);
}

.item-completed {
  background-color: rgba(76, 175, 80, 0.04);
}

.item-error {
  background-color: rgba(244, 67, 54, 0.06);
}

.index-avatar {
  background-color: #1976d2;
  color: white;
  min-width: 28px;
}

.index-text {
  font-size: 12px;
  font-weight: 600;
}

.item-content {
  padding: 0 8px;
  min-width: 0;
}

.item-title {
  font-size: 13px;
  line-height: 1.4;
}

.item-subtitle {
  font-size: 11px;
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 2px;
}

.preview-text {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
}

.empty-state p {
  margin: 4px 0;
}

.batch-list-footer {
  padding: 8px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  flex-shrink: 0;
}

.stats-row {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
}

.stat-chip {
  font-size: 11px;
  height: 22px;
}

.stat-chip >>> .v-chip__content {
  padding: 0 8px;
}

.actions-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
