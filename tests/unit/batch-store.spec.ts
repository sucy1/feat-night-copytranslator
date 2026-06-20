import {
  BatchState,
  BatchParagraph,
  createBatchParagraph,
  emptyBatchState,
  truncateText,
  BatchStatus,
} from "@/batch/types";
import { BatchStore, batchReducer } from "@/batch/batchStore";

describe("batch types", () => {
  describe("createBatchParagraph", () => {
    it("should create a paragraph with trimmed original text", () => {
      const para = createBatchParagraph("  Hello World  ", 1);
      expect(para.original).toBe("Hello World");
      expect(para.index).toBe(1);
      expect(para.status).toBe("idle");
      expect(para.id).toBeDefined();
      expect(para.translation).toBeUndefined();
    });

    it("should generate unique ids for different paragraphs", () => {
      const para1 = createBatchParagraph("Test 1", 1);
      const para2 = createBatchParagraph("Test 2", 2);
      expect(para1.id).not.toBe(para2.id);
    });

    it("should have idle as default status", () => {
      const para = createBatchParagraph("test", 1);
      expect(para.status).toBe("idle");
    });
  });

  describe("emptyBatchState", () => {
    it("should return default empty state", () => {
      const state = emptyBatchState();
      expect(state.isBatchMode).toBe(false);
      expect(state.paragraphs).toEqual([]);
      expect(state.globalStatus).toBe("idle");
    });
  });

  describe("truncateText", () => {
    it("should return original text when shorter than max length", () => {
      expect(truncateText("Short", 100)).toBe("Short");
    });

    it("should truncate and append ellipsis when longer than max length", () => {
      const longText = "a".repeat(150);
      const result = truncateText(longText, 100);
      expect(result.length).toBe(103);
      expect(result.endsWith("...")).toBe(true);
    });

    it("should handle empty string", () => {
      expect(truncateText("", 50)).toBe("");
    });

    it("should use default max length of 100", () => {
      const text = "a".repeat(200);
      const result = truncateText(text);
      expect(result.length).toBe(103);
    });
  });
});

describe("batchReducer - batch selection", () => {
  let initialState: BatchState;

  beforeEach(() => {
    initialState = emptyBatchState();
  });

  describe("TOGGLE_BATCH_MODE", () => {
    it("should toggle batch mode from false to true", () => {
      const state = batchReducer(initialState, { type: "TOGGLE_BATCH_MODE" });
      expect(state.isBatchMode).toBe(true);
    });

    it("should toggle batch mode from true to false", () => {
      const state1 = batchReducer(initialState, { type: "TOGGLE_BATCH_MODE" });
      const state2 = batchReducer(state1, { type: "TOGGLE_BATCH_MODE" });
      expect(state2.isBatchMode).toBe(false);
    });
  });

  describe("SET_BATCH_MODE", () => {
    it("should set batch mode to true", () => {
      const state = batchReducer(initialState, {
        type: "SET_BATCH_MODE",
        payload: true,
      });
      expect(state.isBatchMode).toBe(true);
    });

    it("should set batch mode to false", () => {
      const state1 = batchReducer(initialState, {
        type: "SET_BATCH_MODE",
        payload: true,
      });
      const state2 = batchReducer(state1, {
        type: "SET_BATCH_MODE",
        payload: false,
      });
      expect(state2.isBatchMode).toBe(false);
    });
  });

  describe("ADD_PARAGRAPH - core selection feature", () => {
    it("should add a paragraph to empty list", () => {
      const state = batchReducer(initialState, {
        type: "ADD_PARAGRAPH",
        payload: "Hello",
      });
      expect(state.paragraphs.length).toBe(1);
      expect(state.paragraphs[0].original).toBe("Hello");
      expect(state.paragraphs[0].index).toBe(1);
      expect(state.paragraphs[0].status).toBe("idle");
    });

    it("should trim whitespace from input", () => {
      const state = batchReducer(initialState, {
        type: "ADD_PARAGRAPH",
        payload: "  Hello World  ",
      });
      expect(state.paragraphs[0].original).toBe("Hello World");
    });

    it("should ignore empty or whitespace-only text", () => {
      const state = batchReducer(initialState, {
        type: "ADD_PARAGRAPH",
        payload: "   ",
      });
      expect(state.paragraphs.length).toBe(0);
    });

    it("should not add duplicate paragraphs", () => {
      const state1 = batchReducer(initialState, {
        type: "ADD_PARAGRAPH",
        payload: "Hello",
      });
      const state2 = batchReducer(state1, {
        type: "ADD_PARAGRAPH",
        payload: "Hello",
      });
      expect(state2.paragraphs.length).toBe(1);
    });

    it("should assign sequential indices", () => {
      let state = initialState;
      state = batchReducer(state, { type: "ADD_PARAGRAPH", payload: "First" });
      state = batchReducer(state, { type: "ADD_PARAGRAPH", payload: "Second" });
      state = batchReducer(state, { type: "ADD_PARAGRAPH", payload: "Third" });
      expect(state.paragraphs.map((p) => p.index)).toEqual([1, 2, 3]);
    });

    it("should support multi-line paragraphs", () => {
      const multiLinePara = "Line 1\nLine 2\nLine 3";
      const state = batchReducer(initialState, {
        type: "ADD_PARAGRAPH",
        payload: multiLinePara,
      });
      expect(state.paragraphs.length).toBe(1);
      expect(state.paragraphs[0].original).toBe(multiLinePara);
    });
  });

  describe("REMOVE_PARAGRAPH", () => {
    it("should remove a paragraph by id", () => {
      let state = initialState;
      state = batchReducer(state, { type: "ADD_PARAGRAPH", payload: "First" });
      state = batchReducer(state, { type: "ADD_PARAGRAPH", payload: "Second" });
      const idToRemove = state.paragraphs[0].id;
      state = batchReducer(state, {
        type: "REMOVE_PARAGRAPH",
        payload: idToRemove,
      });
      expect(state.paragraphs.length).toBe(1);
      expect(state.paragraphs[0].original).toBe("Second");
      expect(state.paragraphs[0].index).toBe(1);
    });

    it("should renumber indices after removal", () => {
      let state = initialState;
      state = batchReducer(state, { type: "ADD_PARAGRAPH", payload: "First" });
      state = batchReducer(state, { type: "ADD_PARAGRAPH", payload: "Second" });
      state = batchReducer(state, { type: "ADD_PARAGRAPH", payload: "Third" });
      const idToRemove = state.paragraphs[1].id;
      state = batchReducer(state, {
        type: "REMOVE_PARAGRAPH",
        payload: idToRemove,
      });
      expect(state.paragraphs[0].index).toBe(1);
      expect(state.paragraphs[1].index).toBe(2);
    });
  });

  describe("CLEAR_PARAGRAPHS", () => {
    it("should clear all paragraphs and reset status", () => {
      let state = initialState;
      state = batchReducer(state, { type: "ADD_PARAGRAPH", payload: "First" });
      state = batchReducer(state, {
        type: "SET_GLOBAL_STATUS",
        payload: "translating",
      });
      state = batchReducer(state, { type: "CLEAR_PARAGRAPHS" });
      expect(state.paragraphs.length).toBe(0);
      expect(state.globalStatus).toBe("idle");
    });
  });

  describe("UPDATE_PARAGRAPH - translation results", () => {
    it("should update paragraph status to translating", () => {
      let state = initialState;
      state = batchReducer(state, { type: "ADD_PARAGRAPH", payload: "First" });
      const id = state.paragraphs[0].id;
      state = batchReducer(state, {
        type: "UPDATE_PARAGRAPH",
        payload: { id, updates: { status: "translating" } },
      });
      expect(state.paragraphs[0].status).toBe("translating");
    });

    it("should update paragraph with translation result", () => {
      let state = initialState;
      state = batchReducer(state, { type: "ADD_PARAGRAPH", payload: "Hello" });
      const id = state.paragraphs[0].id;
      state = batchReducer(state, {
        type: "UPDATE_PARAGRAPH",
        payload: {
          id,
          updates: {
            translation: "你好",
            status: "completed",
            engine: "google",
            from: "en",
            to: "zh-CN",
          },
        },
      });
      expect(state.paragraphs[0].translation).toBe("你好");
      expect(state.paragraphs[0].status).toBe("completed");
      expect(state.paragraphs[0].engine).toBe("google");
      expect(state.paragraphs[0].from).toBe("en");
      expect(state.paragraphs[0].to).toBe("zh-CN");
    });

    it("should update paragraph with error status", () => {
      let state = initialState;
      state = batchReducer(state, { type: "ADD_PARAGRAPH", payload: "Hello" });
      const id = state.paragraphs[0].id;
      state = batchReducer(state, {
        type: "UPDATE_PARAGRAPH",
        payload: {
          id,
          updates: { status: "error", errorMessage: "Network error" },
        },
      });
      expect(state.paragraphs[0].status).toBe("error");
      expect(state.paragraphs[0].errorMessage).toBe("Network error");
    });
  });

  describe("SET_GLOBAL_STATUS", () => {
    it("should set global status to translating", () => {
      const state = batchReducer(initialState, {
        type: "SET_GLOBAL_STATUS",
        payload: "translating",
      });
      expect(state.globalStatus).toBe("translating");
    });

    it("should set global status to completed", () => {
      const state = batchReducer(initialState, {
        type: "SET_GLOBAL_STATUS",
        payload: "completed",
      });
      expect(state.globalStatus).toBe("completed");
    });

    it("should set global status to error", () => {
      const state = batchReducer(initialState, {
        type: "SET_GLOBAL_STATUS",
        payload: "error",
      });
      expect(state.globalStatus).toBe("error");
    });
  });

  describe("REORDER_PARAGRAPHS", () => {
    it("should reorder paragraphs and renumber indices", () => {
      let state = initialState;
      state = batchReducer(state, { type: "ADD_PARAGRAPH", payload: "First" });
      state = batchReducer(state, { type: "ADD_PARAGRAPH", payload: "Second" });
      state = batchReducer(state, { type: "ADD_PARAGRAPH", payload: "Third" });

      const reordered = [
        state.paragraphs[2],
        state.paragraphs[0],
        state.paragraphs[1],
      ];
      state = batchReducer(state, {
        type: "REORDER_PARAGRAPHS",
        payload: reordered,
      });

      expect(state.paragraphs[0].original).toBe("Third");
      expect(state.paragraphs[0].index).toBe(1);
      expect(state.paragraphs[1].original).toBe("First");
      expect(state.paragraphs[1].index).toBe(2);
      expect(state.paragraphs[2].original).toBe("Second");
      expect(state.paragraphs[2].index).toBe(3);
    });
  });
});

describe("BatchStore - reactive state management", () => {
  let store: BatchStore;

  beforeEach(() => {
    store = new BatchStore();
  });

  it("should initialize with empty state", () => {
    expect(store.getState().isBatchMode).toBe(false);
    expect(store.getState().paragraphs.length).toBe(0);
    expect(store.getState().globalStatus).toBe("idle");
  });

  it("should notify subscribers on state change", () => {
    const mockSubscriber = jest.fn();
    store.subscribe(mockSubscriber);
    store.toggleBatchMode();
    expect(mockSubscriber).toHaveBeenCalledTimes(1);
  });

  it("should not notify after unsubscribing", () => {
    const mockSubscriber = jest.fn();
    const unsubscribe = store.subscribe(mockSubscriber);
    unsubscribe();
    store.toggleBatchMode();
    expect(mockSubscriber).not.toHaveBeenCalled();
  });

  it("should support multiple subscribers", () => {
    const sub1 = jest.fn();
    const sub2 = jest.fn();
    store.subscribe(sub1);
    store.subscribe(sub2);
    store.addParagraph("test");
    expect(sub1).toHaveBeenCalledTimes(1);
    expect(sub2).toHaveBeenCalledTimes(1);
  });

  it("addParagraph should work correctly", () => {
    store.addParagraph("Test paragraph");
    expect(store.getState().paragraphs.length).toBe(1);
    expect(store.getState().paragraphs[0].original).toBe("Test paragraph");
  });

  it("removeParagraph should work correctly", () => {
    store.addParagraph("First");
    store.addParagraph("Second");
    const id = store.getState().paragraphs[0].id;
    store.removeParagraph(id);
    expect(store.getState().paragraphs.length).toBe(1);
    expect(store.getState().paragraphs[0].original).toBe("Second");
    expect(store.getState().paragraphs[0].index).toBe(1);
  });

  it("clearParagraphs should reset everything", () => {
    store.addParagraph("First");
    store.addParagraph("Second");
    store.setGlobalStatus("translating");
    store.clearParagraphs();
    expect(store.getState().paragraphs.length).toBe(0);
    expect(store.getState().globalStatus).toBe("idle");
  });

  it("toggleBatchMode should toggle correctly", () => {
    expect(store.getState().isBatchMode).toBe(false);
    store.toggleBatchMode();
    expect(store.getState().isBatchMode).toBe(true);
    store.toggleBatchMode();
    expect(store.getState().isBatchMode).toBe(false);
  });

  it("setBatchMode should set correctly", () => {
    store.setBatchMode(true);
    expect(store.getState().isBatchMode).toBe(true);
    store.setBatchMode(false);
    expect(store.getState().isBatchMode).toBe(false);
  });

  it("updateParagraph should update paragraph data", () => {
    store.addParagraph("Hello");
    const id = store.getState().paragraphs[0].id;
    store.updateParagraph(id, {
      translation: "你好",
      status: "completed",
      engine: "google",
    });
    const para = store.getState().paragraphs[0];
    expect(para.translation).toBe("你好");
    expect(para.status).toBe("completed");
    expect(para.engine).toBe("google");
  });

  it("setGlobalStatus should update status", () => {
    store.setGlobalStatus("translating");
    expect(store.getState().globalStatus).toBe("translating");
  });

  it("reorderParagraphs should reorder correctly", () => {
    store.addParagraph("First");
    store.addParagraph("Second");
    store.addParagraph("Third");
    const paras = store.getState().paragraphs;
    store.reorderParagraphs([paras[2], paras[0], paras[1]]);
    expect(store.getState().paragraphs[0].original).toBe("Third");
    expect(store.getState().paragraphs[0].index).toBe(1);
  });

  it("commit should trigger state change notification", () => {
    const mockSubscriber = jest.fn();
    store.subscribe(mockSubscriber);
    store.commit({ type: "ADD_PARAGRAPH", payload: "Test" });
    expect(mockSubscriber).toHaveBeenCalledTimes(1);
    expect(store.getState().paragraphs.length).toBe(1);
  });
});
