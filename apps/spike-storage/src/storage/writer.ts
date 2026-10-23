import { errorDetail } from '#/errors';
import type { SpikeDatabase } from '#/storage/db';
import type { GeneratedPhoto } from '#/storage/photo';

type Log = (name: string, detail?: string) => void;

export type WriterDeps = {
  db: SpikeDatabase;
  savePhoto: (name: string, blob: Blob) => Promise<void>;
  makePhoto: (seq: number) => Promise<GeneratedPhoto>;
  log: Log;
  sessionId: string;
};

export type WriterState = { running: boolean; done: number; total: number };

export const SESSION_SIZE = 100;
export const SESSION_INTERVAL_MS = 300;

function isQuotaError(error: unknown): boolean {
  return error instanceof Error && error.name === 'QuotaExceededError';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class Writer {
  private state: WriterState = { running: false, done: 0, total: 0 };
  private tail: Promise<void> = Promise.resolve();
  private stopRequested = false;
  private readonly listeners = new Set<() => void>();

  constructor(private readonly deps: WriterDeps) {}

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getState = (): WriterState => this.state;

  idle = (): Promise<void> => this.tail;

  writeOne = (): Promise<boolean> => {
    const run = this.tail.then(() => this.write());
    this.tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };

  stop = (): void => {
    if (this.state.running) this.stopRequested = true;
  };

  async startSession(
    total = SESSION_SIZE,
    intervalMs = SESSION_INTERVAL_MS,
  ): Promise<void> {
    if (this.state.running) return;
    this.stopRequested = false;
    this.patch({ running: true, done: 0, total });
    this.deps.log('write-session-started', `${total} colis`);
    let outcome = 'write-session-finished';
    while (this.state.done < total) {
      if (this.stopRequested) {
        outcome = 'write-session-stopped';
        break;
      }
      if (!(await this.writeOne())) {
        outcome = 'write-session-aborted';
        break;
      }
      this.patch({ done: this.state.done + 1 });
      if (this.state.done < total) await sleep(intervalMs);
    }
    this.deps.log(outcome, `${this.state.done}/${total} écrits`);
    this.patch({ running: false });
  }

  private async write(): Promise<boolean> {
    const { db, savePhoto, makePhoto, log, sessionId } = this.deps;
    let seq = 0;
    try {
      const last = await db.parcels.orderBy('seq').last();
      seq = (last?.seq ?? 0) + 1;
      const photo = await makePhoto(seq);
      const photoName = `${sessionId}-${seq}.jpg`;

      const opfsStart = performance.now();
      await savePhoto(photoName, photo.blob);
      const dexieStart = performance.now();

      await db.transaction('rw', db.parcels, db.outbox, async () => {
        const createdAt = Date.now();
        const parcelId = await db.parcels.add({
          seq,
          createdAt,
          photoName,
          photoBytes: photo.blob.size,
          photoSha256: photo.sha256,
          sessionId,
        });
        await db.outbox.add({ parcelId, createdAt, op: 'create' });
      });
      const end = performance.now();

      log(
        'parcel-written',
        `n°${seq} · ${photo.blob.size} octets · OPFS ${Math.round(dexieStart - opfsStart)} ms · Dexie ${Math.round(end - dexieStart)} ms`,
      );
      return true;
    } catch (error) {
      log(
        isQuotaError(error) ? 'quota-exceeded' : 'parcel-write-failed',
        `n°${seq} · ${errorDetail(error)}`,
      );
      return false;
    }
  }

  private patch(change: Partial<WriterState>): void {
    this.state = { ...this.state, ...change };
    for (const listener of this.listeners) listener();
  }
}
