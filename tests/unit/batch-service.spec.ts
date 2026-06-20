jest.mock("electron", () => ({
  clipboard: {
    readText: jest.fn(() => ""),
    writeText: jest.fn(),
  },
}));

jest.mock("@/common/event-bus", () => ({
  __esModule: true,
  default: {
    on: jest.fn(),
    at: jest.fn(),
  },
}));

jest.mock("@/common/logger", () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    toast: jest.fn(),
  },
}));

import { batchStore } from "@/batch/batchStore";
import { batchService } from "@/batch/batchService";

describe("batchService - splitAndAddParagraphs", () => {
  beforeEach(() => {
    batchStore.clearParagraphs();
    jest.clearAllMocks();
  });

  it("should split text by blank lines and add each paragraph", () => {
    const multiParagraphText =
      "First paragraph.\n\nSecond paragraph.\n\nThird paragraph.";

    const count = batchService.splitAndAddParagraphs(multiParagraphText);

    expect(count).toBe(3);
    expect(batchStore.getState().paragraphs.length).toBe(3);
    expect(batchStore.getState().paragraphs[0].original).toBe("First paragraph.");
    expect(batchStore.getState().paragraphs[1].original).toBe("Second paragraph.");
    expect(batchStore.getState().paragraphs[2].original).toBe("Third paragraph.");
  });

  it("should handle multiple consecutive blank lines", () => {
    const text = "Para 1\n\n\n\nPara 2\n\n\nPara 3";
    const count = batchService.splitAndAddParagraphs(text);
    expect(count).toBe(3);
    expect(batchStore.getState().paragraphs.length).toBe(3);
  });

  it("should trim whitespace from each paragraph", () => {
    const text = "  First para  \n\n  Second para  ";
    batchService.splitAndAddParagraphs(text);
    expect(batchStore.getState().paragraphs[0].original).toBe("First para");
    expect(batchStore.getState().paragraphs[1].original).toBe("Second para");
  });

  it("should skip empty paragraphs", () => {
    const text = "First\n\n   \n\nSecond";
    const count = batchService.splitAndAddParagraphs(text);
    expect(count).toBe(2);
    expect(batchStore.getState().paragraphs.length).toBe(2);
  });

  it("should not add duplicate paragraphs", () => {
    batchStore.addParagraph("First paragraph.");
    const text = "First paragraph.\n\nSecond paragraph.";
    const count = batchService.splitAndAddParagraphs(text);
    expect(count).toBe(1);
    expect(batchStore.getState().paragraphs.length).toBe(2);
  });

  it("should handle single paragraph text", () => {
    const text = "Single paragraph only.";
    const count = batchService.splitAndAddParagraphs(text);
    expect(count).toBe(1);
    expect(batchStore.getState().paragraphs.length).toBe(1);
  });

  it("should return 0 for empty text", () => {
    const count = batchService.splitAndAddParagraphs("");
    expect(count).toBe(0);
    expect(batchStore.getState().paragraphs.length).toBe(0);
  });

  it("should return 0 for whitespace-only text", () => {
    const count = batchService.splitAndAddParagraphs("   \n\n  \n\n   ");
    expect(count).toBe(0);
    expect(batchStore.getState().paragraphs.length).toBe(0);
  });

  it("should preserve line breaks within paragraphs", () => {
    const text = "Line 1\nLine 2\nLine 3\n\nAnother para";
    batchService.splitAndAddParagraphs(text);
    expect(batchStore.getState().paragraphs[0].original).toBe("Line 1\nLine 2\nLine 3");
    expect(batchStore.getState().paragraphs[1].original).toBe("Another para");
  });

  it("should assign sequential indices", () => {
    const text = "A\n\nB\n\nC";
    batchService.splitAndAddParagraphs(text);
    expect(batchStore.getState().paragraphs.map((p) => p.index)).toEqual([1, 2, 3]);
  });
});

describe("batchService - count methods", () => {
  beforeEach(() => {
    batchStore.clearParagraphs();
  });

  it("getCompletedCount should return count of completed paragraphs", () => {
    batchStore.addParagraph("First");
    batchStore.addParagraph("Second");
    batchStore.addParagraph("Third");

    const paras = batchStore.getState().paragraphs;
    batchStore.updateParagraph(paras[0].id, { status: "completed" });
    batchStore.updateParagraph(paras[1].id, { status: "completed" });

    expect(batchService.getCompletedCount()).toBe(2);
  });

  it("getPendingCount should return count of idle and translating paragraphs", () => {
    batchStore.addParagraph("First");
    batchStore.addParagraph("Second");
    batchStore.addParagraph("Third");

    const paras = batchStore.getState().paragraphs;
    batchStore.updateParagraph(paras[0].id, { status: "translating" });
    batchStore.updateParagraph(paras[1].id, { status: "completed" });

    expect(batchService.getPendingCount()).toBe(2);
  });

  it("getErrorCount should return count of error paragraphs", () => {
    batchStore.addParagraph("First");
    batchStore.addParagraph("Second");

    const paras = batchStore.getState().paragraphs;
    batchStore.updateParagraph(paras[0].id, { status: "error" });

    expect(batchService.getErrorCount()).toBe(1);
  });

  it("all counts should be 0 for empty list", () => {
    expect(batchService.getCompletedCount()).toBe(0);
    expect(batchService.getPendingCount()).toBe(0);
    expect(batchService.getErrorCount()).toBe(0);
  });
});

describe("batchService - clipboard listener", () => {
  beforeEach(() => {
    batchStore.clearParagraphs();
    batchService.stopClipboardListener();
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    batchService.stopClipboardListener();
    jest.useRealTimers();
  });

  it("clipboardListening should be false initially", () => {
    expect(batchService.clipboardListening).toBe(false);
  });

  it("startClipboardListener should set clipboardListening to true", () => {
    batchService.startClipboardListener();
    expect(batchService.clipboardListening).toBe(true);
  });

  it("stopClipboardListener should set clipboardListening to false", () => {
    batchService.startClipboardListener();
    batchService.stopClipboardListener();
    expect(batchService.clipboardListening).toBe(false);
  });

  it("toggleClipboardListener should toggle the state", () => {
    const result1 = batchService.toggleClipboardListener();
    expect(result1).toBe(true);
    expect(batchService.clipboardListening).toBe(true);

    const result2 = batchService.toggleClipboardListener();
    expect(result2).toBe(false);
    expect(batchService.clipboardListening).toBe(false);
  });

  it("startClipboardListener should not create duplicate watchers", () => {
    const spy = jest.spyOn(global, "setInterval");
    batchService.startClipboardListener();
    batchService.startClipboardListener();
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});

describe("batchService - translateParagraph (mock)", () => {
  beforeEach(() => {
    batchStore.clearParagraphs();
    jest.clearAllMocks();
  });

  it("should set paragraph status to translating when starting", async () => {
    batchStore.addParagraph("Test");
    const para = batchStore.getState().paragraphs[0];

    const promise = batchService.translateParagraph(para);

    expect(batchStore.getState().paragraphs[0].status).toBe("translating");

    await promise.catch(() => {});
  });
});

describe("batchService - retryFailed", () => {
  beforeEach(() => {
    batchStore.clearParagraphs();
  });

  it("should return resolved promise when no failed paragraphs", () => {
    return expect(batchService.retryFailed()).resolves.toBeUndefined();
  });
});

describe("batchService - copyAllTranslations", () => {
  const { clipboard } = require("electron");

  beforeEach(() => {
    batchStore.clearParagraphs();
    clipboard.writeText.mockClear();
  });

  it("should return empty string when no translations", () => {
    const result = batchService.copyAllTranslations();
    expect(result).toBe("");
    expect(clipboard.writeText).not.toHaveBeenCalled();
  });

  it("should copy all translations separated by double newlines", () => {
    batchStore.addParagraph("First");
    batchStore.addParagraph("Second");
    batchStore.addParagraph("Third");

    const paras = batchStore.getState().paragraphs;
    batchStore.updateParagraph(paras[0].id, {
      translation: "译文一",
      status: "completed",
    });
    batchStore.updateParagraph(paras[2].id, {
      translation: "译文三",
      status: "completed",
    });

    const result = batchService.copyAllTranslations();

    expect(result).toBe("译文一\n\n译文三");
    expect(clipboard.writeText).toHaveBeenCalledWith("译文一\n\n译文三");
  });

  it("should skip paragraphs without translation", () => {
    batchStore.addParagraph("First");
    const paras = batchStore.getState().paragraphs;
    batchStore.updateParagraph(paras[0].id, { status: "completed" });

    const result = batchService.copyAllTranslations();
    expect(result).toBe("");
  });
});
