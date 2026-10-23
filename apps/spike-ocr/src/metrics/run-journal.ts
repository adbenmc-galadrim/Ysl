import type { SeriesResult } from '#/metrics/types';

export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type RunState = {
  configId: string;
  label: string;
  source: 'pack' | 'import';
  startedAt: number;
  total: number;
  photo: number;
  photoId: string;
  closed: boolean;
};

export type JournalEvent = {
  at: number;
  name: string;
  detail?: string;
};

export const RUN_KEY = 'spike-ocr:run';
export const RESULTS_KEY = 'spike-ocr:results';
export const EVENTS_KEY = 'spike-ocr:events';
export const PARTIAL_KEY = 'spike-ocr:partial';

const KEPT_EVENTS = 500;
const KEPT_RESULTS = 40;

function read<T>(store: KeyValueStore, key: string): T | undefined {
  try {
    const raw = store.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

export function describeInterruption(run: RunState): string {
  return `plantage ou onglet tué à la photo ${run.photo} de la configuration ${run.label} (${run.configId}), série de ${run.total} photos`;
}

export class RunJournal {
  readonly interrupted: RunState | undefined;
  private events: JournalEvent[];
  private results: SeriesResult[];

  constructor(
    private readonly store: KeyValueStore,
    private readonly now: () => number = Date.now,
  ) {
    const run = read<RunState>(store, RUN_KEY);
    this.interrupted = run && !run.closed ? run : undefined;
    this.events = read<JournalEvent[]>(store, EVENTS_KEY) ?? [];
    this.results = read<SeriesResult[]>(store, RESULTS_KEY) ?? [];
    if (this.interrupted) this.recover(this.interrupted);
  }

  get history(): readonly SeriesResult[] {
    return this.results;
  }

  get entries(): readonly JournalEvent[] {
    return this.events;
  }

  log(name: string, detail?: string): void {
    this.events = [...this.events, { at: this.now(), name, detail }].slice(
      -KEPT_EVENTS,
    );
    this.save(EVENTS_KEY, this.events);
  }

  begin(
    run: Omit<RunState, 'photo' | 'photoId' | 'closed' | 'startedAt'>,
  ): void {
    this.write({
      ...run,
      startedAt: this.now(),
      photo: 0,
      photoId: '',
      closed: false,
    });
  }

  beforePhoto(photo: number, photoId: string): void {
    const run = read<RunState>(this.store, RUN_KEY);
    if (!run) return;
    this.write({ ...run, photo, photoId });
  }

  close(result: SeriesResult): void {
    const run = read<RunState>(this.store, RUN_KEY);
    if (run) this.write({ ...run, closed: true });
    this.results = [...this.results, result].slice(-KEPT_RESULTS);
    this.save(RESULTS_KEY, this.results);
  }

  checkpoint(partial: SeriesResult): void {
    this.save(PARTIAL_KEY, partial);
  }

  clearResults(): void {
    this.results = [];
    this.save(RESULTS_KEY, this.results);
  }

  private recover(run: RunState): void {
    const detail = describeInterruption(run);
    this.log('crash-detected', detail);
    const partial = read<SeriesResult>(this.store, PARTIAL_KEY);
    const recovered: SeriesResult = {
      configId: run.configId,
      label: run.label,
      backend: partial?.backend ?? '',
      source: run.source,
      startedAt: run.startedAt,
      photos: [],
      ...partial,
      outcome: 'crashed',
      detail,
    };
    this.results = [...this.results, recovered].slice(-KEPT_RESULTS);
    this.save(RESULTS_KEY, this.results);
    this.store.removeItem(RUN_KEY);
    this.store.removeItem(PARTIAL_KEY);
  }

  private write(run: RunState): void {
    this.save(RUN_KEY, run);
  }

  private save(key: string, value: unknown): void {
    try {
      this.store.setItem(key, JSON.stringify(value));
    } catch {
      this.events = [
        ...this.events,
        { at: this.now(), name: 'storage-full', detail: key },
      ].slice(-KEPT_EVENTS);
    }
  }
}
