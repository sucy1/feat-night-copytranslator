<template>
  <div class="batch-panel-wrapper" :style="maxParent">
    <div class="batch-panel-header">
      <v-chip color="success" class="batch-mode-badge" small>
        <v-icon left x-small>mdi-format-list-numbered</v-icon>
        批量翻译模式
      </v-chip>
      <v-spacer></v-spacer>
      <v-btn text small @click="exitBatchMode">
        <v-icon x-small left>mdi-close</v-icon>
        退出
      </v-btn>
    </div>

    <div class="batch-panel-body">
      <div class="batch-panel-left">
        <BatchList ref="batchListRef"></BatchList>
      </div>
      <div class="batch-panel-divider"></div>
      <div class="batch-panel-right">
        <BatchResult></BatchResult>
      </div>
    </div>

    <div class="batch-panel-footer" v-if="selectedText">
      <v-alert type="info" dense outlined :value="true" class="selection-alert">
        <v-icon x-small left>mdi-select-drag</v-icon>
        <span class="selection-preview">
          已选中: "{{ truncateText(selectedText, 60) }}"
        </span>
        <v-spacer></v-spacer>
        <v-btn text small color="primary" @click="addSelectedText">
          <v-icon x-small left>mdi-plus</v-icon>
          添加到列表
        </v-btn>
        <v-btn text small @click="clearSelection">
          <v-icon x-small>mdi-close</v-icon>
        </v-btn>
      </v-alert>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Mixins, Ref } from "vue-property-decorator";
import BaseView from "@/components/BaseView.vue";
import { batchStore } from "./batchStore";
import { truncateText } from "./types";
import BatchList from "./BatchList.vue";
import BatchResult from "./BatchResult.vue";

@Component({
  components: {
    BatchList,
    BatchResult,
  },
})
export default class BatchPanel extends Mixins(BaseView) {
  @Ref("batchListRef") readonly batchListRef!: BatchList;

  unsubscribe: (() => void) | null = null;
  selectedText: string = "";

  truncateText(text: string, max: number): string {
    return truncateText(text, max);
  }

  exitBatchMode(): void {
    batchStore.setBatchMode(false);
    this.selectedText = "";
  }

  addSelectedText(): void {
    if (this.selectedText.trim()) {
      batchStore.addParagraph(this.selectedText);
      this.selectedText = "";
    }
  }

  clearSelection(): void {
    this.selectedText = "";
  }

  setSelectedText(text: string): void {
    this.selectedText = text;
  }

  get maxParent() {
    return {
      height: `calc(100vh - ${this.titlebarHeight})`,
      width: "100%",
      padding: "0px",
      "--content-padding": `${this.contentPadding}px`,
      "--content-line-height": this.contentLineHeight.toString(),
    };
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
.batch-panel-wrapper {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: inherit;
}

.batch-panel-header {
  display: flex;
  align-items: center;
  padding: 6px 12px;
  background: linear-gradient(90deg, rgba(76, 175, 80, 0.1) 0%, transparent 100%);
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.batch-mode-badge {
  margin: 0;
}

.batch-panel-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.batch-panel-left {
  flex: 0 0 45%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-right: none;
}

.batch-panel-divider {
  width: 1px;
  background: rgba(0, 0, 0, 0.08);
}

.batch-panel-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.batch-panel-footer {
  padding: 4px 8px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

.selection-alert {
  margin: 0;
  display: flex;
  align-items: center;
}

.selection-preview {
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 300px;
}
</style>
