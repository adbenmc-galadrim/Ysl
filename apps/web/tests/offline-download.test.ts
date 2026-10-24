import { describe, expect, it, vi } from 'vitest';
import {
  downloadMissing,
  readProgress,
  type CacheLike,
  type DownloadProgress,
} from '#/features/offline/download';

const BASE = 'http://app/assets/';
const DET = `${BASE}det.onnx`;
const REC = `${BASE}rec.onnx`;
const WASM = `${BASE}ort.wasm`;

function memoryCache(): CacheLike & { store: Map<string, Response> } {
  const store = new Map<string, Response>();
  return {
    store,
    match: (url) => Promise.resolve(store.get(url)?.clone()),
    put: (url, response) => {
      store.set(url, response);
      return Promise.resolve();
    },
    keys: () =>
      Promise.resolve([...store.keys()].map((url) => new Request(url))),
    delete: (url) => Promise.resolve(store.delete(url)),
  };
}

const stored = (bytes: number) =>
  new Response(new Uint8Array(bytes), {
    headers: { 'Content-Length': String(bytes) },
  });

type Served = Record<
  string,
  { bytes: number; status?: number; fail?: boolean }
>;

/** A server that streams each file in two chunks and answers HEAD with the size. */
function server(files: Served) {
  const calls: string[] = [];
  const fetcher = vi.fn((url: string, init?: RequestInit) => {
    const file = files[url];
    calls.push(`${init?.method ?? 'GET'} ${url}`);
    if (!file) return Promise.resolve(new Response(null, { status: 404 }));
    if (file.fail && init?.method !== 'HEAD') {
      return Promise.reject(new TypeError('offline'));
    }
    const headers = { 'Content-Length': String(file.bytes) };
    if (init?.method === 'HEAD') {
      return Promise.resolve(new Response(null, { headers }));
    }
    if (file.status) {
      return Promise.resolve(new Response(null, { status: file.status }));
    }
    const half = Math.floor(file.bytes / 2);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(half));
        controller.enqueue(new Uint8Array(file.bytes - half));
        controller.close();
      },
    });
    return Promise.resolve(new Response(stream, { headers }));
  });
  return { fetcher: fetcher as unknown as typeof fetch, calls };
}

describe('downloadMissing', () => {
  it('skips the files already in the cache and counts their bytes', async () => {
    const cache = memoryCache();
    cache.store.set(DET, stored(100));
    const { fetcher, calls } = server({ [REC]: { bytes: 300 } });

    const outcome = await downloadMissing([DET, REC], {
      cache,
      fetch: fetcher,
    });

    expect(outcome.status).toBe('done');
    expect(outcome.progress).toEqual({
      bytes: 400,
      total: 400,
      files: 2,
      filesDone: 2,
    });
    expect(calls).toEqual([`HEAD ${REC}`, `GET ${REC}`]);
    expect(cache.store.has(REC)).toBe(true);
  });

  it('reports the bytes as they stream, file after file', async () => {
    const cache = memoryCache();
    const { fetcher } = server({
      [DET]: { bytes: 100 },
      [REC]: { bytes: 300 },
    });
    const seen: DownloadProgress[] = [];

    await downloadMissing([DET, REC], {
      cache,
      fetch: fetcher,
      onProgress: (progress) => seen.push(progress),
    });

    expect(seen.map((progress) => progress.bytes)).toEqual([
      0, 50, 100, 100, 250, 400, 400, 400,
    ]);
    expect(seen.every((progress) => progress.total === 400)).toBe(true);
    expect(seen.at(-1)?.filesDone).toBe(2);
  });

  it('keeps the finished files when a later one fails, and says so', async () => {
    const cache = memoryCache();
    const { fetcher } = server({
      [DET]: { bytes: 100 },
      [REC]: { bytes: 300, fail: true },
      [WASM]: { bytes: 500 },
    });

    const outcome = await downloadMissing([DET, REC, WASM], {
      cache,
      fetch: fetcher,
    });

    expect(outcome.status).toBe('failed');
    expect(outcome.progress).toEqual({
      bytes: 100,
      total: 900,
      files: 3,
      filesDone: 1,
    });
    expect([...cache.store.keys()]).toEqual([DET]);

    const again = await downloadMissing([DET, REC, WASM], {
      cache,
      fetch: server({ [REC]: { bytes: 300 }, [WASM]: { bytes: 500 } }).fetcher,
    });
    expect(again.status).toBe('done');
    expect(again.progress.bytes).toBe(900);
  });

  it('does not cache an error page', async () => {
    const cache = memoryCache();
    const { fetcher } = server({ [DET]: { bytes: 100, status: 404 } });

    const outcome = await downloadMissing([DET], { cache, fetch: fetcher });

    expect(outcome.status).toBe('failed');
    expect(cache.store.size).toBe(0);
  });

  it('drops the files of another build from the cache', async () => {
    const cache = memoryCache();
    cache.store.set(`${BASE}det-old.onnx`, stored(100));
    cache.store.set(DET, stored(100));

    await downloadMissing([DET], { cache, fetch: server({}).fetcher });

    expect([...cache.store.keys()]).toEqual([DET]);
  });

  it('counts files when a size is unknown', async () => {
    const cache = memoryCache();
    const fetcher = vi.fn((_url: string, init?: RequestInit) =>
      Promise.resolve(
        init?.method === 'HEAD'
          ? new Response(null)
          : new Response(new Uint8Array(new ArrayBuffer(10))),
      ),
    ) as unknown as typeof fetch;

    const outcome = await downloadMissing([DET], { cache, fetch: fetcher });

    expect(outcome.status).toBe('done');
    expect(outcome.progress).toEqual({
      bytes: 10,
      total: 10,
      files: 1,
      filesDone: 1,
    });
  });
});

describe('readProgress', () => {
  it('reads what the cache holds without a request', async () => {
    const cache = memoryCache();
    cache.store.set(DET, stored(100));

    await expect(readProgress([DET, REC], cache)).resolves.toEqual({
      bytes: 100,
      total: null,
      files: 2,
      filesDone: 1,
      missing: [REC],
    });
    await expect(readProgress([DET], cache)).resolves.toMatchObject({
      total: 100,
      filesDone: 1,
      missing: [],
    });
  });
});
