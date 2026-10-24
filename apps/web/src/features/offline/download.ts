export type DownloadProgress = {
  /** Bytes on the device, finished files and the one in flight. */
  bytes: number;
  /** Bytes of every file, or null while one size is unknown. */
  total: number | null;
  files: number;
  filesDone: number;
};

/** The slice of `Cache` the download uses, so a test can hand in a map. */
export type CacheLike = {
  match(url: string): Promise<Response | undefined>;
  put(url: string, response: Response): Promise<void>;
  keys(): Promise<readonly Request[]>;
  delete(url: string): Promise<boolean>;
};

export type DownloadOptions = {
  cache: CacheLike;
  fetch?: typeof fetch;
  onProgress?: (progress: DownloadProgress) => void;
};

export type DownloadOutcome =
  | { status: 'done'; progress: DownloadProgress }
  | { status: 'failed'; progress: DownloadProgress; error: unknown };

const sizeOf = (response: Response | undefined): number | null => {
  const header = response?.headers.get('content-length');
  if (header === null || header === undefined) return null;
  const size = Number(header);
  return Number.isFinite(size) && size >= 0 ? size : null;
};

const sum = (sizes: (number | null)[]): number | null =>
  sizes.reduce<number | null>(
    (acc, size) => (acc === null || size === null ? null : acc + size),
    0,
  );

/** Drops the files of an older build so the cache holds one set of models. */
export async function dropStale(
  urls: string[],
  cache: CacheLike,
): Promise<number> {
  const wanted = new Set(urls);
  const keys = await cache.keys();
  let dropped = 0;
  for (const key of keys) {
    if (wanted.has(key.url)) continue;
    if (await cache.delete(key.url)) dropped += 1;
  }
  return dropped;
}

/**
 * What the cache already holds of the list: the progress at launch, before
 * any request. Every file in the cache counts as done.
 */
export async function readProgress(
  urls: string[],
  cache: CacheLike,
): Promise<DownloadProgress & { missing: string[] }> {
  const cached = await Promise.all(urls.map((url) => cache.match(url)));
  const missing = urls.filter((_url, index) => !cached[index]);
  const sizes = cached.map(sizeOf);
  const bytes = sizes.reduce<number>((acc, size) => acc + (size ?? 0), 0);
  return {
    bytes,
    total: missing.length === 0 ? sum(sizes) : null,
    files: urls.length,
    filesDone: urls.length - missing.length,
    missing,
  };
}

async function headSize(
  url: string,
  fetcher: typeof fetch,
): Promise<number | null> {
  try {
    const response = await fetcher(url, { method: 'HEAD' });
    return response.ok ? sizeOf(response) : null;
  } catch {
    return null;
  }
}

async function readBody(
  response: Response,
  onChunk: (bytes: number) => void,
): Promise<Uint8Array<ArrayBuffer>> {
  if (!response.body) {
    const buffer = new Uint8Array(await response.arrayBuffer());
    onChunk(buffer.byteLength);
    return buffer;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    length += value.byteLength;
    onChunk(value.byteLength);
  }
  const buffer = new Uint8Array(new ArrayBuffer(length));
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return buffer;
}

/**
 * Fetches the files the cache lacks, one after the other, and stores each
 * as it lands: a run cut short keeps what it got and the next one starts
 * from there. Sizes come from `Content-Length` (a HEAD per missing file
 * first), so the bar can say "18 Mo sur 42 Mo"; without them it counts
 * files. The first failure stops the run and is reported, never thrown.
 */
export async function downloadMissing(
  urls: string[],
  { cache, fetch: fetcher = globalThis.fetch, onProgress }: DownloadOptions,
): Promise<DownloadOutcome> {
  await dropStale(urls, cache);
  const initial = await readProgress(urls, cache);
  const { missing } = initial;
  const cachedSizes = await Promise.all(
    urls
      .filter((url) => !missing.includes(url))
      .map(async (url) => sizeOf(await cache.match(url))),
  );
  const missingSizes = await Promise.all(
    missing.map((url) => headSize(url, fetcher)),
  );
  let progress: DownloadProgress = {
    bytes: initial.bytes,
    total: sum([...cachedSizes, ...missingSizes]),
    files: urls.length,
    filesDone: initial.filesDone,
  };
  const report = (patch: Partial<DownloadProgress>) => {
    progress = { ...progress, ...patch };
    onProgress?.(progress);
  };
  report({});

  for (const [index, url] of missing.entries()) {
    const expected = missingSizes[index] ?? null;
    const before = progress.bytes;
    try {
      const response = await fetcher(url);
      if (!response.ok) {
        throw new Error(`${url}: ${response.status}`);
      }
      const body = await readBody(response, (chunk) =>
        report({ bytes: progress.bytes + chunk }),
      );
      const headers = new Headers();
      headers.set('Content-Length', String(body.byteLength));
      const type = response.headers.get('content-type');
      if (type) headers.set('Content-Type', type);
      await cache.put(url, new Response(body, { status: 200, headers }));
      const total =
        progress.total === null
          ? null
          : progress.total - (expected ?? body.byteLength) + body.byteLength;
      report({
        bytes: before + body.byteLength,
        total,
        filesDone: progress.filesDone + 1,
      });
    } catch (error) {
      report({ bytes: before });
      return { status: 'failed', progress, error };
    }
  }
  report({ total: progress.bytes });
  return { status: 'done', progress };
}
