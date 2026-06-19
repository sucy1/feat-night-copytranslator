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

    <div class="batch-result-scroll">
      <v-simple-table dense class="batch-result-table" v-if="completedCount > 0">
        <thead>
          <tr>
            <th class="col-index">#</th>
            <th class="col-source">原文</th>
            <th class="col-target">译文</th>
            <th class="col-diff">差异</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="para in translatedParagraphs"
            :key="para.id"
            class="result-row"
          >
            <td class="col-index">
              <v-chip small color="primary" class="index-chip">
                {{ para.index }}
              </v-chip>
            </td>
            <td class="col-source">
              <div class="cell-content">{{ para.original }}</div>
            </td>
            <td class="col-target">
              <div class="cell-content translation-text">
                {{ para.translation }}
              </div>
              <div class="cell-meta">
                <v-chip small outlined class="meta-chip">
                  {{ para.engine || "unknown" }}
                </v-chip>
                <v-chip small outlined class="meta-chip" v-if="para.from && para.to">
                  {{ para.from }} → {{ para.to }}
                </v-chip>
              </div>
            </td>
            <td class="col-diff">
              <div class="cell-content diff-content">
                <span
                  v-for="(part, idx) in getDiffParts(para)"
                  :key="idx"
                  :class="getDiffClass(part)"
                >{{ part.value }}</span>
              </div>
            </td>
          </tr>
        </tbody>
      </v-simple-table>

      <div v-else class="empty-state">
        <v-icon large color="grey lighten-1">mdi-translate</v-icon>
        <p class="grey--text">暂无翻译结果</p>
        <p class="caption grey--text">在左侧添加段落并点击"批量翻译"</p>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Mixins } from "vue-property-decorator";
import BaseView from "@/components/BaseView.vue";
import { batchStore } from "./batchStore";
import { BatchParagraph, DiffSegment } from "./types";
import { clipboard } from "@/main/clipboard";
import logger from "@/common/logger";
import { isChinese } from "@/common/translate/helper";

const Diff = require("diff");

@Component
export default class BatchResult extends Mixins(BaseView) {
  unsubscribe: (() => void) | null = null;

  get paragraphs(): BatchParagraph[] {
    return batchStore.getState().paragraphs;
  }

  get translatedParagraphs(): BatchParagraph[] {
    return this.paragraphs.filter((p) => p.status === "completed");
  }

  get completedCount(): number {
    return this.translatedParagraphs.length;
  }

  get totalCount(): number {
    return this.paragraphs.length;
  }

  getDiffParts(para: BatchParagraph): DiffSegment[] {
    if (!para.translation) return [{ text: "", type: "same" }];

    const isChineseStyle = isChinese(para.original);
    const diffFunc = isChineseStyle ? Diff.diffChars : Diff.diffWords;

    try {
      const parts = diffFunc(para.original, para.translation);
      return parts.map((p: any) => ({
        text: p.value,
        type: p.added ? "added" : p.removed ? "removed" : "same",
      }));
    } catch {
      return [{ text: para.translation || "", type: "same" }];
    }
  }

  getDiffClass(part: DiffSegment): string {
    switch (part.type) {
      case "added":
        return "diff-added";
      case "removed":
        return "diff-removed";
      default:
        return "diff-same";
    }
  }

  copyAllTranslations(): void {
    const translations = this.translatedParagraphs
      .map((p, idx) => `${idx + 1}. ${p.translation}`)
      .join("\n\n");
    if (translations) {
      clipboard.writeText(translations);
      logger.toast(`已复制 ${this.completedCount} 段译文`);
    }
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
}

.batch-result-title {
  font-size: 14px;
  font-weight: 600;
}

.batch-result-scroll {
  flex: 1;
  overflow: auto;
  padding: 0 8px 8px;
}

.batch-result-table {
  width: 100%;
  border-radius: 6px;
}

.batch-result-table >>> table {
  table-layout: fixed;
}

.col-index {
  width: 50px;
  text-align: center;
}

.col-source {
  width: 30%;
}

.col-target {
  width: 35%;
}

.col-diff {
  width: 35%;
}

.result-row {
  vertical-align: top;
}

.result-row:hover {
  background-color: rgba(0, 0, 0, 0.02);
}

.index-chip {
  margin: 0;
  font-size: 11px;
}

.cell-content {
  padding: 4px 0;
  font-size: 13px;
  line-height: 1.6;
  word-break: break-word;
  white-space: pre-wrap;
}

.translation-text {
  color: #1976d2;
}

.cell-meta {
  display: flex;
  gap: 4px;
  margin-top: 6px;
  flex-wrap: wrap;
}

.meta-chip {
  font-size: 10px;
  height: 20px;
  padding: 0 6px;
}

.diff-content {
  font-family: monospace;
  font-size: 12px;
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
