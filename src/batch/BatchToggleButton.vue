<template>
  <v-tooltip bottom open-delay="100">
    <template v-slot:activator="{ on, attrs }">
      <v-btn
        v-bind="attrs"
        v-on="on"
        :color="isBatchMode ? 'success' : 'primary'"
        small
        depressed
        tile
        :outlined="config.transparency > 0.5"
        class="batch-toggle-btn"
        :height="btnSize.height"
        :width="btnSize.width"
        @click="handleToggle"
      >
        <v-badge
          v-if="paragraphCount > 0"
          :content="paragraphCount.toString()"
          color="error"
          :offset-x="-4"
          :offset-y="4"
          dot
        >
          <v-icon :size="btnSize.font">mdi-format-list-numbered</v-icon>
        </v-badge>
        <v-icon v-else :size="btnSize.font">mdi-format-list-numbered</v-icon>
      </v-btn>
    </template>
    <span>{{ tooltipText }}</span>
  </v-tooltip>
</template>

<script lang="ts">
import { Component, Mixins } from "vue-property-decorator";
import BaseView from "@/components/BaseView.vue";
import { batchStore } from "./batchStore";

@Component
export default class BatchToggleButton extends Mixins(BaseView) {
  unsubscribe: (() => void) | null = null;

  get isBatchMode(): boolean {
    return batchStore.getState().isBatchMode;
  }

  get paragraphCount(): number {
    return batchStore.getState().paragraphs.length;
  }

  get tooltipText(): string {
    return this.isBatchMode ? "退出批量模式" : "进入批量模式";
  }

  get btnSize() {
    return {
      height: this.titlebarHeight,
      width: `${this.titlebarHeightVal + 8}px`,
      font: Math.ceil(this.titlebarHeightVal * 0.7),
    };
  }

  handleToggle(): void {
    batchStore.toggleBatchMode();
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
.batch-toggle-btn {
  padding: 0px !important;
  min-width: 0px !important;
}
</style>
