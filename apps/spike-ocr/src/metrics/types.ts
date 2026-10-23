import type { Accuracy, PhotoScore } from '#/scoring/scoring';

export type StoredLine = { text: string; score: number };

export type PhotoResult = {
  id: string;
  name: string;
  ok: boolean;
  error?: string;
  width?: number;
  height?: number;
  prepMs: number;
  ocrMs: number;
  totalMs: number;
  wasmHeapBytes?: number;
  jsHeapBytes?: number;
  lines?: StoredLine[];
  score?: PhotoScore;
};

export type SeriesOutcome = 'complete' | 'load-failed' | 'stopped' | 'crashed';

export type SeriesResult = {
  configId: string;
  label: string;
  backend: string;
  source: 'pack' | 'import';
  startedAt: number;
  outcome: SeriesOutcome;
  detail?: string;
  loadMs?: number;
  fetchMs?: number;
  initMs?: number;
  warmupMs?: number;
  modelBytes?: number;
  threads?: number;
  photos: PhotoResult[];
  accuracy?: Accuracy;
};
