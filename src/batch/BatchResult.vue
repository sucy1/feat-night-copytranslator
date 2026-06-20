<template>
  <div class="batch-result-container">
    <v-toolbar flat dense color="transparent" class="batch-result-toolbar">
      <v-toolbar-title class="batch-result-title">
        <v-icon small class="mr-1">mdi-table</v-icon>
        翻译对照
        <v-chip
          v-if="completedCount > 0"
          small
          color="success"
          class="ml-2"
          :outlined="true"
        >
          {{ completedCount }}/{{ totalCount }}
        </v-chip>
      </v-toolbar-title>
      <v-spacer></v-spacer>
      <v-btn
        text
        small
        :disabled="completedCount === 0"
        @click="copyAllTranslations"
      >
        <v-icon small>mdi-content-copy</v-icon>
        复制全部译文
      </v-btn>
    </v-toolbar>

    <div class="filter-row">
      <v-btn-toggle
        v-model="filterStatus"
        dense
        small
        group
        mandatory
      >
        <v-btn value="all">
          <v-icon x-small left>mdi-format-list-bulleted</v-icon>
          全部
          <v-chip small class="ml-1" outlined>{{ totalCount }}</v-chip>
        </v-btn>
        <v-btn value="completed">
          <v-icon x-small left color="success">mdi-check-circle</v-icon>
          已完成
          <v-chip small color="success" class="ml-1" outlined>{{ completedCount }}</v-chip>
        </v-btn>
        <v-btn value="error">
          <v-icon x-small left color="error">mdi-alert</v-icon>
          失败
          <v-chip small color="error" class="ml-1" outlined>{{ errorCount }}</v-chip>
        </v-btn>
      </v-btn-toggle>
    </div>

    <div class="batch-result-scroll">
      <div v-if="filteredParagraphs.length > 0" class="result-list">
        <v-card
          v-for="para in filteredParagraphs"
          :key="para.id"
          class="result-card"
          flat
          :class="{
            'card-translating': para.status === 'translating',
            'card-completed': para.status === 'completed',
            'card-error': para.status === 'error',
          }"
        >
          <v-card-title class="card-header">
            <v-chip small color="primary" class="index-chip">
              #{{ para.index }}
            </v-chip>
            <v-spacer></v-spacer>
            <v-chip
              small
              :color="getStatusColor(para.status)"
              outlined
              class="status-chip"
            >
              <v-icon x-small left>
                {{ getStatusIcon(para.status) }}
              </v-icon>
              {{ getStatusText(para.status) }}
            </v-chip>
          </v-card-title>

          <v-card-text class="card-body">
            <div class="row-section source-section">
              <div class="section-label">
                <v-icon x-small>mdi-text-box</v-icon>
                <span>原文</span>
              </div>
              <div class="section-content source-text">{{ para.original }}</div>
            </div>

            <v-divider class="card-divider" v-if="para.status === 'completed'"></v-divider>

            <div v-if="para.status === 'completed'" class="row-section target-section">
              <div class="section-label">
                <v-icon x-small color="primary">mdi-translate</v-icon>
                <span>译文</span>
                <span v-if="para.engine" class="engine-tag">({{ para.engine }})</span>
              </div>
              <div class="section-content translation-text">{{ para.translation }}</div>
            </div>

            <div v-else-if="para.status === 'error'" class="error-section">
              <v-alert type="error" dense outlined :value="true" class="error-alert">
                <v-icon x-small left>mdi-alert-circle</v-icon>
                {{ para.errorMessage || "翻译失败，请检查网络或重试" }}
              </v-alert>
            </div>

            <div v-else-if="para.status === 'translating'" class="loading-section">
              <v-progress-linear
                indeterminate
                color="primary"
                height="2"
              ></v-progress-linear>
              <p class="loading-text">正在翻译...</p>
            </div>

            <div v-if="para.status === 'completed' && expandedDiffIds.has(para.id)" class="diff-section">
              <v-divider class="card-divider"></v-divider>
              <div class="section-label">
                <v-icon x-small color="deep-purple">mdi-compare</v-icon>
                <span>差异对比</span>
              </div>
              <div class="section-content diff-content">
                <span
                  v-for="(part, idx) in getDiffParts(para)"
                  :key="idx"
                  :class="getDiffClass(part)"
                >{{ part.value }}</span>
              </div>
            </div>
          </v-card-text>

          <v-card-actions class="card-actions">
            <v-btn
              v-if="para.status === 'completed'"
              text
              x-small
              @click="toggleDiff(para.id)"
            >
              <v-icon x-small left>mdi-compare</v-icon>
              {{ expandedDiffIds.has(para.id) ? '隐藏差异' : '显示差异' }}
            </v-btn>
            <v-btn
              v-if="para.status === 'completed'"
              text
              x-small
              @click="copyTranslation(para)"
            >
              <v-icon x-small left>mdi-content-copy</v-icon>
              复制译文
            </v-btn>
            <v-btn
              v-if="para.status === 'error'"
              text
              x-small
              color="warning"
              @click="retrySingle(para)"
              :disabled="isTranslating"
            >
              <v-icon x-small left>mdi-refresh</v-icon>
              重试
            </v-btn>
            <v-spacer></v-spacer>
            <span v-if="para.from && para.to" class="lang-info caption">
              {{ para.from }} → {{ para.to }}
            </span>
          </v-card-actions>
        </v-card>
      </div>

      <div v-else class="empty-state">
        <v-icon large color="grey lighten-1">
          {{ filterStatus === 'error' ? 'mdi-alert-circle-outline' : 'mdi-translate' }}
        </v-icon>
        <p class="grey--text">
          {{ emptyStateText }}
        </p>
        <p class="caption grey--text">
          在左侧添加段落并点击"批量翻译"
        </p>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Mixins } from "vue-property-decorator";
import BaseView from "@/components/BaseView.vue";
import { batchStore } from "./batchStore";
import { batchService } from "./batchService";
import { BatchParagraph, DiffSegment } from "./types";
import { clipboard } from "electron";
import { isChinese } from "@/common/translate/helper";
import logger from "@/common/logger";

const Diff = require("diff");

@Component
export default class BatchResult extends Mixins(BaseView) {
  unsubscribe: (() => void) | null = null;
  filterStatus: "all" | "completed" | "error" = "all";
  expandedDiffIds: Set<string> = new Set();

  get paragraphs(): BatchParagraph[] {
    return batchStore.getState().paragraphs;
  }

  get isTranslating(): boolean {
    return batchStore.getState().globalStatus === "translating";
  }

  get completedCount(): number {
    return batchService.getCompletedCount();
  }

  get errorCount(): number {
    return batchService.getErrorCount();
  }

  get totalCount(): number {
    return this.paragraphs.length;
  }

  get filteredParagraphs(): BatchParagraph[] {
    switch (this.filterStatus) {
      case "completed":
        return this.paragraphs.filter((p) => p.status === "completed");
      case "error":
        return this.paragraphs.filter((p) => p.status === "error");
      default:
        return this.paragraphs;
    }
  }

  get emptyStateText(): string {
    if (this.totalCount === 0) {
      return "暂无翻译结果";
    }
    switch (this.filterStatus) {
      case "completed":
        return "暂无已完成的翻译";
      case "error":
        return "暂无失败的翻译";
      default:
        return "暂无翻译结果";
    }
  }

  getStatusColor(status: string): string {
    switch (status) {
      case "completed":
        return "success";
      case "translating":
        return "primary";
      case "error":
        return "error";
      default:
        return "grey";
    }
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case "completed":
        return "mdi-check-circle";
      case "translating":
        return "mdi-sync";
      case "error":
        return "mdi-alert";
      default:
        return "mdi-clock-outline";
    }
  }

  getStatusText(status: string): string {
    switch (status) {
      case "completed":
        return "已完成";
      case "translating":
        return "翻译中";
      case "error":
        return "失败";
      default:
        return "等待中";
    }
  }

  getDiffParts(para: BatchParagraph): Array<{ value: string; added?: boolean; removed?: boolean }> {
    if (!para.translation) return [{ value: "" }];

    const isChineseStyle = isChinese(para.original);
    const diffFunc = isChineseStyle ? Diff.diffChars : Diff.diffWords;

    try {
      return diffFunc(para.original, para.translation);
    } catch {
      return [{ value: para.translation || "" }];
    }
  }

  getDiffClass(part: { added?: boolean; removed?: boolean }): string {
    if (part.added) return "diff-added";
    if (part.removed) return "diff-removed";
    return "diff-same";
  }

  toggleDiff(id: string): void {
    if (this.expandedDiffIds.has(id)) {
      this.expandedDiffIds.delete(id);
    } else {
      this.expandedDiffIds.add(id);
    }
  }

  copyTranslation(para: BatchParagraph): void {
    if (para.translation) {
      clipboard.writeText(para.translation);
      logger.toast("译文已复制到剪贴板");
    }
  }

  copyAllTranslations(): void {
    batchService.copyAllTranslations();
  }

  async retrySingle(para: BatchParagraph): Promise<void> {
    await batchService.translateParagraph(para);
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
.batch-result-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.batch-result-toolbar {
  min-height: 40px;
  padding: 0 8px;
  flex-shrink: 0;
}

.batch-result-title {
  font-size: 14px;
  font-weight: 600;
}

.filter-row {
  padding: 0 8px 8px;
  flex-shrink: 0;
}

.filter-row >>> .v-btn {
  font-size: 11px;
  padding: 0 8px;
}

.batch-result-scroll {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0 8px 8px;
}

.result-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.result-card {
  border-radius: 8px;
  overflow: hidden;
  transition: box-shadow 0.2s;
}

.result-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.card-translating {
  border-left: 3px solid #2196f3;
}

.card-completed {
  border-left: 3px solid #4caf50;
}

.card-error {
  border-left: 3px solid #f44336;
}

.card-header {
  padding: 8px 12px !important;
  font-size: 13px;
  display: flex;
  align-items: center;
}

.index-chip {
  margin: 0;
  font-size: 11px;
  height: 22px;
}

.status-chip {
  margin: 0;
  font-size: 10px;
  height: 20px;
}

.card-body {
  padding: 0 12px 8px !important;
}

.row-section {
  padding: 6px 0;
}

.section-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #666;
  margin-bottom: 4px;
}

.section-label .engine-tag {
  color: #999;
  font-weight: normal;
}

.section-content {
  font-size: 13px;
  line-height: 1.6;
  word-break: break-word;
  white-space: pre-wrap;
}

.source-text {
  color: #333;
}

.translation-text {
  color: #1565c0;
  font-weight: 500;
}

.card-divider {
  margin: 6px 0;
}

.diff-section {
  padding-top: 6px;
}

.diff-content {
  font-family: "SF Mono", Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  line-height: 1.6;
  padding: 8px;
  background: #fafafa;
  border-radius: 4px;
  word-break: break-word;
}

.diff-added {
  background-color: #c8e6c9;
  color: #2e7d32;
  padding: 0 2px;
  border-radius: 2px;
}

.diff-removed {
  background-color: #ffcdd2;
  color: #c62828;
  text-decoration: line-through;
  padding: 0 2px;
  border-radius: 2px;
}

.diff-same {
  color: inherit;
}

.error-section {
  padding: 8px 0;
}

.error-alert {
  margin: 0;
}

.loading-section {
  padding: 16px 0;
  text-align: center;
}

.loading-text {
  margin-top: 8px;
  font-size: 12px;
  color: #666;
}

.card-actions {
  padding: 4px 8px !important;
  border-top: 1px solid rgba(0, 0, 0, 0.04);
}

.card-actions >>> .v-btn {
  font-size: 11px;
  text-transform: none;
}

.lang-info {
  color: #999;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
}

.empty-state p {
  margin: 4px 0;
}
</style>
