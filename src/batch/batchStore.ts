import Vue from "vue";
import {
  BatchState,
  BatchParagraph,
  BatchStatus,
  emptyBatchState,
  createBatchParagraph,
} from "./types";

export type BatchMutation =
  | { type: "TOGGLE_BATCH_MODE" }
  | { type: "SET_BATCH_MODE"; payload: boolean }
  | { type: "ADD_PARAGRAPH"; payload: string }
  | { type: "REMOVE_PARAGRAPH"; payload: string }
  | { type: "CLEAR_PARAGRAPHS" }
  | { type: "UPDATE_PARAGRAPH"; payload: { id: string; updates: Partial<BatchParagraph> } }
  | { type: "SET_GLOBAL_STATUS"; payload: BatchStatus }
  | { type: "REORDER_PARAGRAPHS"; payload: BatchParagraph[] };

function generateReorderedIndex(paragraphs: BatchParagraph[]): BatchParagraph[] {
  return paragraphs.map((p, idx) => ({ ...p, index: idx + 1 }));
}

export function batchReducer(
  state: BatchState,
  mutation: BatchMutation
): BatchState {
  switch (mutation.type) {
    case "TOGGLE_BATCH_MODE":
      return { ...state, isBatchMode: !state.isBatchMode };
    case "SET_BATCH_MODE":
      return { ...state, isBatchMode: mutation.payload };
    case "ADD_PARAGRAPH": {
      const trimmed = mutation.payload.trim();
      if (!trimmed) return state;
      const exists = state.paragraphs.some((p) => p.original === trimmed);
      if (exists) return state;
      const newPara = createBatchParagraph(trimmed, state.paragraphs.length + 1);
      return { ...state, paragraphs: [...state.paragraphs, newPara] };
    }
    case "REMOVE_PARAGRAPH": {
      const filtered = state.paragraphs.filter((p) => p.id !== mutation.payload);
      return {
        ...state,
        paragraphs: generateReorderedIndex(filtered),
      };
    }
    case "CLEAR_PARAGRAPHS":
      return { ...state, paragraphs: [], globalStatus: "idle" };
    case "UPDATE_PARAGRAPH": {
      return {
        ...state,
        paragraphs: state.paragraphs.map((p) =>
          p.id === mutation.payload.id
            ? { ...p, ...mutation.payload.updates }
            : p
        ),
      };
    }
    case "SET_GLOBAL_STATUS":
      return { ...state, globalStatus: mutation.payload };
    case "REORDER_PARAGRAPHS":
      return {
        ...state,
        paragraphs: generateReorderedIndex(mutation.payload),
      };
    default:
      return state;
  }
}

export class BatchStore {
  private state: BatchState;
  private listeners: Set<() => void> = new Set();

  constructor(initialState: BatchState = emptyBatchState()) {
    this.state = Vue.observable(initialState);
  }

  getState(): BatchState {
    return this.state;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener());
  }

  commit(mutation: BatchMutation): void {
    this.state = batchReducer(this.state, mutation);
    this.notify();
  }

  toggleBatchMode(): void {
    this.commit({ type: "TOGGLE_BATCH_MODE" });
  }

  setBatchMode(value: boolean): void {
    this.commit({ type: "SET_BATCH_MODE", payload: value });
  }

  addParagraph(text: string): void {
    this.commit({ type: "ADD_PARAGRAPH", payload: text });
  }

  removeParagraph(id: string): void {
    this.commit({ type: "REMOVE_PARAGRAPH", payload: id });
  }

  clearParagraphs(): void {
    this.commit({ type: "CLEAR_PARAGRAPHS" });
  }

  updateParagraph(id: string, updates: Partial<BatchParagraph>): void {
    this.commit({ type: "UPDATE_PARAGRAPH", payload: { id, updates } });
  }

  setGlobalStatus(status: BatchStatus): void {
    this.commit({ type: "SET_GLOBAL_STATUS", payload: status });
  }

  reorderParagraphs(paragraphs: BatchParagraph[]): void {
    this.commit({ type: "REORDER_PARAGRAPHS", payload: paragraphs });
  }
}

export const batchStore = new BatchStore();
