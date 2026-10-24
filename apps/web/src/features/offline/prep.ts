import {
  downloadMissing,
  readProgress,
  type CacheLike,
  type DownloadProgress,
} from '#/features/offline/download';
import { openModelsCache, readerUrls } from '#/features/offline/models-cache';
import type { ModelsSnapshot, ShellSnapshot } from '#/features/offline/packs';

export type PrepSnapshot = { models: ModelsSnapshot; shell: ShellSnapshot };

/** How long the service worker may take to install before the screen offers to start anyway. */
const SHELL_TIMEOUT_MS = 90_000;
/** Without a registration by then, this build has no service worker (dev server). */
const REGISTRATION_WAIT_MS = 5_000;

const EMPTY_PROGRESS: DownloadProgress = {
  bytes: 0,
  total: null,
  files: 0,
  filesDone: 0,
};

let snapshot: PrepSnapshot = {
  models: { state: 'running', progress: EMPTY_PROGRESS },
  shell: { state: 'running', bytes: null },
};
const listeners = new Set<() => void>();
let started = false;
let downloading: Promise<void> | null = null;

function set(patch: Partial<PrepSnapshot>) {
  snapshot = { ...snapshot, ...patch };
  for (const listener of listeners) listener();
}

const setModels = (models: ModelsSnapshot) => set({ models });

async function precacheBytes(): Promise<number | null> {
  if (typeof caches === 'undefined') return null;
  try {
    const key = (await caches.keys()).find(
      (name) =>
        name.startsWith('workbox-precache') && name.includes(location.origin),
    );
    if (!key) return null;
    const cache = await caches.open(key);
    const responses = await cache.matchAll();
    let bytes = 0;
    for (const response of responses) {
      const length = response.headers.get('content-length');
      if (length === null) return null;
      bytes += Number(length);
    }
    return bytes;
  } catch {
    return null;
  }
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  const until = Date.now() + REGISTRATION_WAIT_MS;
  while (Date.now() < until) {
    const found = await navigator.serviceWorker.getRegistration('/');
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return null;
}

/** The app shell is the service worker's precache: done once a worker controls the scope. */
async function watchShell() {
  if (!('serviceWorker' in navigator) || !(await registration())) {
    set({ shell: { state: 'done', bytes: null } });
    return;
  }
  const timeout = setTimeout(() => {
    if (snapshot.shell.state === 'running') {
      set({ shell: { state: 'paused', bytes: null } });
    }
  }, SHELL_TIMEOUT_MS);
  await navigator.serviceWorker.ready;
  clearTimeout(timeout);
  set({ shell: { state: 'done', bytes: await precacheBytes() } });
}

async function runDownload(cache: CacheLike) {
  const outcome = await downloadMissing(readerUrls(), {
    cache,
    onProgress: (progress) => setModels({ state: 'running', progress }),
  });
  setModels({
    state: outcome.status === 'done' ? 'done' : 'paused',
    progress: outcome.progress,
  });
}

/**
 * Downloads what the reader still lacks, once at a time. A failure leaves
 * the pack paused: nothing restarts by itself, so a phone that lost its
 * Wi-Fi does not spend its data; the screen's button or the next launch does.
 */
export function resumeDownload(): Promise<void> {
  if (downloading) return downloading;
  downloading = (async () => {
    const cache = await openModelsCache();
    if (!cache) {
      setModels({ state: 'done', progress: EMPTY_PROGRESS });
      return;
    }
    setModels({ state: 'running', progress: snapshot.models.progress });
    await runDownload(cache);
  })().finally(() => {
    downloading = null;
  });
  return downloading;
}

/**
 * At each session start: reads what is already on the device, then fetches
 * the rest if the network is there. Idempotent for the page's lifetime.
 */
export function startOfflinePrep(): void {
  if (started) return;
  started = true;
  void watchShell();
  void (async () => {
    const cache = await openModelsCache();
    if (!cache) {
      setModels({ state: 'done', progress: EMPTY_PROGRESS });
      return;
    }
    const { missing, ...progress } = await readProgress(readerUrls(), cache);
    if (missing.length === 0) {
      setModels({ state: 'done', progress });
      return;
    }
    if (!navigator.onLine) {
      setModels({ state: 'paused', progress });
      return;
    }
    await resumeDownload();
  })();
}

export const subscribePrep = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getPrepSnapshot = () => snapshot;
