import type { Target } from '#/compose/urls';

export type Verdict = 'ok' | 'partial' | 'ko';

export type Trial = {
  id: string;
  at: number;
  target: Target | 'share';
  source: string;
  recipients: number;
  subjectLength: number;
  bodyLength: number;
  urlLength?: number;
  left?: boolean;
  outcome?: string;
  verdict?: Verdict;
  note?: string;
};

export type Device = Record<string, string | number | boolean>;

export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>;

type Saved = { trials: Trial[]; loads: number[] };

const STORAGE_KEY = 'spike-email:journal';

function readSaved(store: KeyValueStore): Saved {
  try {
    const raw = store.getItem(STORAGE_KEY);
    const parsed = (raw ? JSON.parse(raw) : {}) as Partial<Saved> | null;
    return {
      trials: Array.isArray(parsed?.trials) ? parsed.trials : [],
      loads: Array.isArray(parsed?.loads) ? parsed.loads : [],
    };
  } catch {
    return { trials: [], loads: [] };
  }
}

export class Journal {
  private items: Trial[];
  private loadedAt: number[];
  private readonly listeners = new Set<() => void>();
  private version = 0;
  private saveFailed = false;

  constructor(
    private readonly store: KeyValueStore,
    readonly device: Device,
    private readonly now: () => number = Date.now,
  ) {
    const saved = readSaved(store);
    this.items = saved.trials;
    this.loadedAt = saved.loads;
  }

  get trials(): readonly Trial[] {
    return this.items;
  }

  get loads(): readonly number[] {
    return this.loadedAt;
  }

  markLoad(): void {
    this.loadedAt = [...this.loadedAt, this.now()];
    this.save();
  }

  reloadedAfter(trial: Trial): boolean {
    return this.loadedAt.some((at) => at > trial.at);
  }

  get notSaved(): boolean {
    return this.saveFailed;
  }

  add(trial: Omit<Trial, 'id' | 'at'>): string {
    const at = this.now();
    const id = `${at}-${this.items.length + 1}`;
    this.items = [...this.items, { id, at, ...trial }];
    this.save();
    return id;
  }

  update(id: string, patch: Partial<Omit<Trial, 'id' | 'at'>>): void {
    this.items = this.items.map((trial) =>
      trial.id === id ? { ...trial, ...patch } : trial,
    );
    this.save();
  }

  clear(): void {
    this.items = [];
    this.loadedAt = [];
    this.save();
  }

  toJSON() {
    return { device: this.device, loads: this.loadedAt, trials: this.items };
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getVersion = (): number => this.version;

  private save(): void {
    try {
      this.store.setItem(
        STORAGE_KEY,
        JSON.stringify({ trials: this.items, loads: this.loadedAt }),
      );
      this.saveFailed = false;
    } catch {
      this.saveFailed = true;
    }
    this.version += 1;
    for (const listener of this.listeners) listener();
  }
}
