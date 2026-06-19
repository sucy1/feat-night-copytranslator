export type BatchStatus = "idle" | "translating" | "completed" | "error";

export interface BatchParagraph {
  id: string;
  index: number;
  original: string;
  translation?: string;
  from?: string;
  to?: string;
  engine?: string;
  status: BatchStatus;
  errorMessage?: string;
}

export interface BatchState {
  isBatchMode: boolean;
  paragraphs: BatchParagraph[];
  globalStatus: BatchStatus;
}

export interface DiffSegment {
  text: string;
  type: "same" | "added" | "removed";
}

export function createBatchParagraph(
  original: string,
  index: number
): BatchParagraph {
  return {
    id: `${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`,
    index,
    original: original.trim(),
    status: "idle",
  };
}

export function emptyBatchState(): BatchState {
  return {
    isBatchMode: false,
    paragraphs: [],
    globalStatus: "idle",
  };
}

export function truncateText(text: string, maxLength: number = 100): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength) + "...";
}
