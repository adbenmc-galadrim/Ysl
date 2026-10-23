import { findConfig } from '#/engines/configs';
import type { OcrLine } from '#/engines/types';
import type { RunJournal } from '#/metrics/run-journal';
import type { PhotoResult, SeriesResult, StoredLine } from '#/metrics/types';
import type { PhotoSource } from '#/pack/types';
import { accuracyOf, scorePhoto } from '#/scoring/scoring';
import { OcrClient } from '#/worker/client';

export type RunPhase = 'loading' | 'warmup' | 'running' | 'done';

export type RunProgress = {
  phase: RunPhase;
  index: number;
  total: number;
};

export type RunOptions = {
  configId: string;
  photos: readonly PhotoSource[];
  source: 'pack' | 'import';
  directory: readonly string[];
  baseUrl: string;
  journal: RunJournal;
  onProgress?: (progress: RunProgress) => void;
  onPhoto?: (photo: PhotoResult, lines: OcrLine[], blob: Blob) => void;
  shouldStop?: () => boolean;
};

const WORKER_DEAD = 'erreur du worker';
const TIMEOUT = 'délai dépassé';
export const STEP_TIMEOUT_MS = 90_000;

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(
          new Error(`${TIMEOUT} (${STEP_TIMEOUT_MS / 1000} s) : ${label}`),
        ),
      STEP_TIMEOUT_MS,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

function stored(lines: readonly OcrLine[]): StoredLine[] {
  return lines.map((line) => ({
    text: line.text,
    score: Math.round(line.score * 100) / 100,
  }));
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function runSeries(options: RunOptions): Promise<SeriesResult> {
  const { journal, photos, directory } = options;
  const config = findConfig(options.configId);
  const total = photos.length;
  const result: SeriesResult = {
    configId: config.id,
    label: config.label,
    backend: config.backend,
    source: options.source,
    startedAt: Date.now(),
    outcome: 'complete',
    photos: [],
  };
  const progress = (phase: RunPhase, index: number) =>
    options.onProgress?.({ phase, index, total });

  journal.begin({
    configId: config.id,
    label: config.label,
    source: options.source,
    total,
  });
  journal.log(
    'series-start',
    `${config.id} · ${options.source} · ${total} photos`,
  );
  progress('loading', 0);
  const client = new OcrClient(options.baseUrl);
  try {
    const loaded = await withTimeout(client.load(config.id), 'chargement');
    if (loaded.type !== 'loaded') {
      result.outcome = 'load-failed';
      result.detail =
        loaded.type === 'load-failed' ? loaded.error : 'réponse inattendue';
      journal.log('load-failed', `${config.id} : ${result.detail}`);
      return result;
    }
    result.loadMs = loaded.loadMs;
    result.fetchMs = loaded.info.fetchMs;
    result.initMs = loaded.info.initMs;
    result.modelBytes = loaded.info.modelBytes;
    result.threads = loaded.info.threads;
    journal.log('loaded', `${config.id} en ${Math.round(loaded.loadMs)} ms`);

    progress('warmup', 0);
    const warmed = await withTimeout(client.warmup(), 'préchauffage');
    if (warmed.type !== 'warmed') {
      result.outcome = 'load-failed';
      result.detail = `préchauffage : ${warmed.type === 'failed' ? warmed.error : 'réponse inattendue'}`;
      journal.log('warmup-failed', result.detail);
      return result;
    }
    result.warmupMs = warmed.ms;

    for (const [index, photo] of photos.entries()) {
      if (options.shouldStop?.()) {
        result.outcome = 'stopped';
        result.detail = 'arrêtée à la main';
        break;
      }
      progress('running', index);
      journal.beforePhoto(index + 1, photo.id);
      const record: PhotoResult = {
        id: photo.id,
        name: photo.name,
        ok: false,
        prepMs: 0,
        ocrMs: 0,
        totalMs: 0,
      };
      let blob: Blob | undefined;
      let detail: OcrLine[] = [];
      let workerDead = false;
      try {
        blob = await photo.blob();
        const recognized = await withTimeout(client.recognize(blob), photo.id);
        detail = recognized.lines;
        Object.assign(record, {
          ok: true,
          width: recognized.width,
          height: recognized.height,
          prepMs: recognized.timings.prepMs,
          ocrMs: recognized.timings.ocrMs,
          totalMs: recognized.timings.totalMs,
          wasmHeapBytes: recognized.wasmHeapBytes,
          jsHeapBytes: recognized.jsHeapBytes,
          lines: stored(recognized.lines),
        });
      } catch (error) {
        record.error = errorText(error);
        workerDead =
          record.error.startsWith(WORKER_DEAD) ||
          record.error.startsWith(TIMEOUT);
        journal.log('photo-failed', `${photo.id} : ${record.error}`);
      }
      if (photo.truth) {
        record.score = scorePhoto(
          photo.truth,
          record.ok ? detail.map((line) => line.text) : undefined,
          directory,
        );
      }
      result.photos.push(record);
      result.accuracy = accuracyOf(
        result.photos.flatMap((entry) => (entry.score ? [entry.score] : [])),
      );
      journal.checkpoint(result);
      if (blob) options.onPhoto?.(record, detail, blob);
      if (workerDead) {
        result.outcome = 'crashed';
        result.detail = `worker mort à la photo ${index + 1} : ${record.error}`;
        break;
      }
    }
    progress('done', result.photos.length);
    return result;
  } catch (error) {
    const detail = errorText(error);
    result.outcome = detail.startsWith(TIMEOUT) ? 'load-failed' : 'crashed';
    result.detail = detail;
    journal.log('series-error', detail);
    return result;
  } finally {
    try {
      await withTimeout(client.dispose(), 'libération');
    } catch {
      journal.log('dispose-failed', config.id);
    }
    client.terminate();
    journal.close(result);
    journal.log('series-end', `${config.id} : ${result.outcome}`);
  }
}
