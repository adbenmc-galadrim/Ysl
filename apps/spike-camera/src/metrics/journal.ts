import type { CaptureMode } from '#/camera/capture';

export type JournalEvent = {
  kind: 'event';
  at: number;
  name: string;
  detail?: string;
};

export type JournalCapture = {
  kind: 'capture';
  at: number;
  index: number;
  burst?: number;
  mode: CaptureMode;
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
  bytes: number;
  durationMs: number;
  intervalMs?: number;
  orientation?: number;
  heapBytes?: number;
};

export type JournalEntry = JournalEvent | JournalCapture;

export type CaptureStats = {
  count: number;
  lastIntervalMs?: number;
  maxIntervalMs?: number;
  p95IntervalMs?: number;
  maxDurationMs?: number;
  p95DurationMs?: number;
  restarts: number;
  failures: number;
};

export type Device = Record<string, string | number | boolean>;

export type Session = {
  id: string;
  startedAt: number;
  closedAt?: number;
  device: Device;
  entries: JournalEntry[];
};

export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>;

const STORAGE_KEY = 'spike-camera:sessions';
const KEPT_SESSIONS = 5;

function readSessions(store: KeyValueStore): Session[] {
  try {
    const raw = store.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Session[]) : [];
  } catch {
    return [];
  }
}

function percentile(values: number[], rank: number): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil((rank / 100) * sorted.length) - 1];
}

function max(values: number[]): number | undefined {
  return values.length === 0 ? undefined : Math.max(...values);
}

export function captureStats(entries: readonly JournalEntry[]): CaptureStats {
  const captures = entries.filter(
    (entry): entry is JournalCapture => entry.kind === 'capture',
  );
  const intervals = captures.flatMap((capture) =>
    capture.intervalMs === undefined ? [] : [capture.intervalMs],
  );
  const durations = captures.map((capture) => capture.durationMs);
  const events = entries.filter((entry) => entry.kind === 'event');
  return {
    count: captures.length,
    lastIntervalMs: intervals.at(-1),
    maxIntervalMs: max(intervals),
    p95IntervalMs: percentile(intervals, 95),
    maxDurationMs: max(durations),
    p95DurationMs: percentile(durations, 95),
    restarts: events.filter((event) => event.name === 'stream-restarted')
      .length,
    failures: events.filter((event) => event.name.endsWith('-failed')).length,
  };
}

export class Journal {
  readonly session: Session;
  readonly interrupted: Session | undefined;
  private readonly history: Session[];
  private readonly listeners = new Set<() => void>();
  private version = 0;

  constructor(
    private readonly store: KeyValueStore,
    device: Device,
    private readonly now: () => number = Date.now,
  ) {
    const history = readSessions(store);
    const last = history.at(-1);
    this.interrupted = last && last.closedAt === undefined ? last : undefined;
    const startedAt = now();
    this.session = { id: String(startedAt), startedAt, device, entries: [] };
    this.history = [...history.slice(-(KEPT_SESSIONS - 1)), this.session];
    this.save();
  }

  get sessions(): readonly Session[] {
    return this.history;
  }

  log(name: string, detail?: string): void {
    this.push({ kind: 'event', at: this.now(), name, detail });
  }

  capture(
    capture: Omit<JournalCapture, 'kind' | 'index' | 'intervalMs'>,
  ): number {
    const captures = this.session.entries.filter(
      (entry): entry is JournalCapture => entry.kind === 'capture',
    );
    const previous = captures.at(-1);
    const intervalMs =
      previous &&
      capture.burst !== undefined &&
      capture.burst === previous.burst
        ? capture.at - previous.at
        : undefined;
    const index = captures.length + 1;
    this.push({ kind: 'capture', index, intervalMs, ...capture });
    return index;
  }

  close(): void {
    this.session.closedAt = this.now();
    this.save();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getVersion = (): number => this.version;

  protected push(entry: JournalEntry): void {
    this.session.entries.push(entry);
    this.save();
  }

  private save(): void {
    try {
      this.store.setItem(STORAGE_KEY, JSON.stringify(this.history));
    } catch {
      this.session.entries.push({
        kind: 'event',
        at: this.now(),
        name: 'journal-not-saved',
      });
    }
    this.version += 1;
    for (const listener of this.listeners) listener();
  }
}
