import { createLocalVue, mount, Wrapper } from "@vue/test-utils";
import Vuetify from "vuetify";
import Vuex from "vuex";
import Component from "vue-class-component";

import {
  createBatchParagraph,
  emptyBatchState,
  BatchParagraph,
} from "@/batch/types";

describe("batch types and data integrity", () => {
  it("createBatchParagraph should produce valid paragraph object", () => {
    const para = createBatchParagraph("测试文本内容", 5);
    expect(para).toMatchObject({
      index: 5,
      original: "测试文本内容",
      status: "idle",
    });
    expect(para.id).toMatch(/^\d+-\d+-[a-z0-9]+$/);
  });

  it("emptyBatchState should produce valid empty state", () => {
    const state = emptyBatchState();
    expect(state.isBatchMode).toBe(false);
    expect(state.paragraphs).toEqual([]);
    expect(state.globalStatus).toBe("idle");
  });

  it("BatchParagraph type guard test", () => {
    const paragraphs: BatchParagraph[] = [
      createBatchParagraph("English text.", 1),
      createBatchParagraph("中文文本", 2),
    ];
    expect(paragraphs.length).toBe(2);
    expect(paragraphs[0].original).toBe("English text.");
    expect(paragraphs[1].original).toBe("中文文本");
  });
});

describe("batch paragraph status flows", () => {
  it("should handle status transitions correctly", () => {
    const para = createBatchParagraph("Hello", 1);
    expect(para.status).toBe("idle");

    para.status = "translating";
    expect(para.status).toBe("translating");

    para.translation = "你好";
    para.status = "completed";
    expect(para.status).toBe("completed");
    expect(para.translation).toBe("你好");

    para.status = "error";
    para.errorMessage = "Network error";
    expect(para.status).toBe("error");
    expect(para.errorMessage).toBe("Network error");
  });

  it("should support optional fields can be set", () => {
    const para = createBatchParagraph("Hello", 1);
    para.from = "en";
    para.to = "zh-CN";
    para.engine = "google";
    para.translation = "你好";
    expect(para.from).toBe("en");
    expect(para.to).toBe("zh-CN");
    expect(para.engine).toBe("google");
    expect(para.translation).toBe("你好");
  });
});
