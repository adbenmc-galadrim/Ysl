import type { MatchStatus } from '#/decode/match';
import type { Device } from '#/device';
import type { DecodeResult } from '#/worker/protocol';

export type Mode = 'viewfinder' | 'native';

export type Verdict = MatchStatus;

export type Trial = {
  id: string;
  at: number;
  parcel: number;
  mode: Mode;
  carrier: string;
  verdict: Verdict | null;
  note: string;
  result: DecodeResult | null;
  error: string | null;
};

export type JournalEvent = { at: number; name: string; detail?: string };

export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>;

export type Rate = { trials: number; read: number; rate: number | null };

export type Stored = {
  parcel: number;
  trials: Trial[];
  events: JournalEvent[];
};

export const STORAGE_KEY = 'spike-barcode:journal';

const KEPT_EVENTS = 200;
const MODES: readonly string[] = ['viewfinder', 'native'];
const VERDICTS: readonly string[] = [
  'read',
  'code-sans-tracking',
  'aucun-code',
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isTrial = (value: unknown): value is Trial =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.at === 'number' &&
  typeof value.parcel === 'number' &&
  typeof value.mode === 'string' &&
  MODES.includes(value.mode) &&
  typeof value.carrier === 'string' &&
  (value.verdict === null ||
    (typeof value.verdict === 'string' && VERDICTS.includes(value.verdict))) &&
  typeof value.note === 'string';

const isEvent = (value: unknown): value is JournalEvent =>
  isRecord(value) &&
  typeof value.at === 'number' &&
  typeof value.name === 'string';

export const readStored = (store: KeyValueStore): Stored => {
  const empty: Stored = { parcel: 1, trials: [], events: [] };
  try {
    const raw = store.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!isRecord(parsed)) return empty;
    const trials = Array.isArray(parsed.trials)
      ? parsed.trials.filter(isTrial).map((t) => ({
          ...t,
          result:
            isRecord(t.result) && Array.isArray(t.result.symbols)
              ? t.result
              : null,
          error: t.error ?? null,
        }))
      : [];
    const events = Array.isArray(parsed.events)
      ? parsed.events.filter(isEvent)
      : [];
    const highest = Math.max(0, ...trials.map((t) => t.parcel));
    const stored =
      typeof parsed.parcel === 'number' && parsed.parcel >= 1
        ? Math.floor(parsed.parcel)
        : 1;
    return { parcel: Math.max(stored, highest, 1), trials, events };
  } catch {
    return empty;
  }
};

export const rates = (
  trials: readonly Trial[],
  keyOf: (trial: Trial) => string,
): Record<string, Rate> => {
  const groups: Record<string, Rate> = {};
  for (const trial of trials) {
    if (trial.verdict === null) continue;
    const key = keyOf(trial);
    const group = (groups[key] ??= { trials: 0, read: 0, rate: null });
    group.trials += 1;
    if (trial.verdict === 'read') group.read += 1;
    group.rate = group.read / group.trials;
  }
  return groups;
};

export class Journal {
  private state: Stored;
  private readonly listeners = new Set<() => void>();
  private version = 0;
  saveFailed = false;

  constructor(
    private readonly store: KeyValueStore,
    readonly device: Device,
    private readonly now: () => number = Date.now,
  ) {
    this.state = readStored(store);
  }

  get parcel(): number {
    return this.state.parcel;
  }

  get trials(): readonly Trial[] {
    return this.state.trials;
  }

  get events(): readonly JournalEvent[] {
    return this.state.events;
  }

  nextParcel(): number {
    this.state = { ...this.state, parcel: this.state.parcel + 1 };
    this.save();
    return this.state.parcel;
  }

  addTrial(
    input: Pick<Trial, 'mode' | 'carrier'> & {
      result: DecodeResult | null;
      error?: string;
    },
  ): Trial {
    const at = this.now();
    const trial: Trial = {
      id: `${at}-${this.state.trials.length}`,
      at,
      parcel: this.state.parcel,
      mode: input.mode,
      carrier: input.carrier,
      verdict: null,
      note: '',
      result: input.result,
      error: input.error ?? null,
    };
    this.state = { ...this.state, trials: [...this.state.trials, trial] };
    this.save();
    return trial;
  }

  updateTrial(
    id: string,
    patch: Partial<Pick<Trial, 'verdict' | 'note' | 'carrier'>>,
  ): void {
    this.state = {
      ...this.state,
      trials: this.state.trials.map((t) =>
        t.id === id ? { ...t, ...patch } : t,
      ),
    };
    this.save();
  }

  log(name: string, detail?: string): void {
    const events = [
      ...this.state.events,
      { at: this.now(), name, detail },
    ].slice(-KEPT_EVENTS);
    this.state = { ...this.state, events };
    this.save();
  }

  clear(): void {
    this.state = { parcel: 1, trials: [], events: [] };
    this.save();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getVersion = (): number => this.version;

  private save(): void {
    try {
      this.store.setItem(STORAGE_KEY, JSON.stringify(this.state));
      this.saveFailed = false;
    } catch {
      this.saveFailed = true;
    }
    this.version += 1;
    for (const listener of this.listeners) listener();
  }
}
