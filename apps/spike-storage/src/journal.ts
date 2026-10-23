export type JournalEvent = {
  at: number;
  name: string;
  detail?: string;
};

export type Device = Record<string, string | number | boolean>;

export type Session = {
  id: string;
  startedAt: number;
  closedAt?: number;
  closeReason?: string;
  device: Device;
  entries: JournalEvent[];
};

export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>;

const STORAGE_KEY = 'spike-storage:journal';
const KEPT_SESSIONS = 5;
const WRITE_STARTED = 'write-session-started';
const WRITE_ENDED = new Set([
  'write-session-finished',
  'write-session-stopped',
  'write-session-aborted',
]);

function hasUnfinishedWrite(session: Session): boolean {
  let open = false;
  for (const entry of session.entries) {
    if (entry.name === WRITE_STARTED) open = true;
    else if (WRITE_ENDED.has(entry.name)) open = false;
  }
  return open;
}

function readSessions(store: KeyValueStore): Session[] {
  try {
    const raw = store.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Session[]) : [];
  } catch {
    return [];
  }
}

export class Journal {
  readonly session: Session;
  interrupted: Session | undefined;
  writeInterrupted: Session | undefined;
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
    this.writeInterrupted = last && hasUnfinishedWrite(last) ? last : undefined;
    const startedAt = now();
    this.session = { id: String(startedAt), startedAt, device, entries: [] };
    this.history = [...history.slice(-(KEPT_SESSIONS - 1)), this.session];
    this.save();
  }

  get sessions(): readonly Session[] {
    return this.history;
  }

  log(name: string, detail?: string): void {
    this.session.entries.push({ at: this.now(), name, detail });
    this.save();
  }

  clear(): void {
    this.session.entries.length = 0;
    this.interrupted = undefined;
    this.writeInterrupted = undefined;
    this.history.splice(0, this.history.length, this.session);
    this.save();
  }

  close(reason: string): void {
    this.session.closedAt = this.now();
    this.session.closeReason = reason;
    this.save();
  }

  reopen(): void {
    if (this.session.closedAt === undefined) return;
    delete this.session.closedAt;
    delete this.session.closeReason;
    this.save();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getVersion = (): number => this.version;

  private save(): void {
    try {
      this.store.setItem(STORAGE_KEY, JSON.stringify(this.history));
    } catch {
      this.session.entries.push({
        at: this.now(),
        name: 'journal-not-saved',
      });
    }
    this.version += 1;
    for (const listener of this.listeners) listener();
  }
}
