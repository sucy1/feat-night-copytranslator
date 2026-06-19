<template>
  <div class="batch-list-container">
    <v-toolbar flat dense color="transparent" class="batch-list-toolbar">
      <v-toolbar-title class="batch-list-title">
        <v-icon small class="mr-1">mdi-format-list-bulleted</v-icon>
        待翻译列表 ({{ paragraphs.length }})
      </v-toolbar-title>
      <v-spacer></v-spacer>
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

    <v-text-field
      v-model="newParagraphText"
      dense
      flat
      solo
      hide-details
      placeholder="输入或粘贴文本后按回车添加..."
      prepend-inner-icon="mdi-plus"
      class="batch-input"
      @keydown.enter="addCurrentText"
      :disabled="isTranslating"
    ></v-text-field>

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
                {{ truncateText(para.original, 80) }}
              </span>
            </v-list-item-title>
            <v-list-item-subtitle v-if="para.status === 'error'" class="error-text">
              <v-icon x-small color="error">mdi-alert</v-icon>
              {{ para.errorMessage || "翻译失败" }}
            </v-list-item-subtitle>
            <v-list-item-subtitle v-else-if="para.status === 'completed'" class="success-text">
              <v-icon x-small color="success">mdi-check-circle</v-icon>
              已翻译
            </v-list-item-subtitle>
            <v-list-item-subtitle v-else-if="para.status === 'translating'" class="translating-text">
              <v-progress-circular
                indeterminate
                color="primary"
                :size="12"
                :width="2"
                class="mr-1"
              ></v-progress-circular>
              翻译中...
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
        <p class="caption grey--text">在上方输入框添加文本，或选中文本后添加</p>
      </div>
    </div>

    <div class="batch-list-actions">
      <v-btn
        block
        color="primary"
        :disabled="paragraphs.length === 0 || isTranslating"
        :loading="isTranslating"
        @click="handleTranslate"
      >
        <v-icon left>mdi-translate</v-icon>
        {{ isTranslating ? "翻译中..." : `批量翻译 (${paragraphs.length} 段)` }}
      </v-btn>
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

@Component
export default class BatchList extends Mixins(BaseView) {
  newParagraphText: string = "";
  unsubscribe: (() => void) | null = null;

  get paragraphs(): BatchParagraph[] {
    return batchStore.getState().paragraphs;
  }

  get isTranslating(): boolean {
    return batchStore.getState().globalStatus === "translating";
  }

  truncateText(text: string, max: number): string {
    return truncateText(text, max);
  }

  addCurrentText(): void {
    if (!this.newParagraphText.trim()) return;
    batchStore.addParagraph(this.newParagraphText);
    this.newParagraphText = "";
  }

  addTextFromExternal(text: string): void {
    batchStore.addParagraph(text);
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

  mounted(): void {
    this.unsubscribe = batchStore.subscribe(() => {
      this.$forceUpdate();
    });
  }

  beforeDestroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
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
}

.batch-list-title {
  font-size: 14px;
  font-weight: 600;
}

.batch-input {
  margin: 0 8px 8px;
}

.batch-input >>> .v-input__slot {
  border-radius: 6px;
}

.batch-list-scroll {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

.batch-list {
  padding: 0;
}

.batch-list-item {
  padding: 4px 8px;
  min-height: 48px;
  border-radius: 6px;
  margin: 2px 6px;
  transition: background-color 0.2s;
}

.batch-list-item:hover {
  background-color: rgba(0, 0, 0, 0.04);
}

.item-translating {
  background-color: rgba(33, 150, 243, 0.08);
}

.item-completed {
  background-color: rgba(76, 175, 80, 0.06);
}

.item-error {
  background-color: rgba(244, 67, 54, 0.08);
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
}

.item-title {
  font-size: 13px;
}

.preview-text {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.error-text {
  color: #f44336;
  font-size: 11px;
}

.success-text {
  color: #4caf50;
  font-size: 11px;
}

.translating-text {
  color: #2196f3;
  font-size: 11px;
  display: flex;
  align-items: center;
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

.batch-list-actions {
  padding: 8px;
}
</style>
