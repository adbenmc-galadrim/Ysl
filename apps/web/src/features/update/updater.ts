import { useSyncExternalStore } from 'react';
import { registerSW } from 'virtual:pwa-register';
import {
  compareVersion,
  INITIAL_UPDATE_STATE,
  isAppCache,
  offersUpdate,
  reduceUpdate,
  type UpdateEvent,
  type UpdateState,
} from '#/features/update/version';

const CHECK_INTERVAL_MS = 30 * 60_000;
const TAKEOVER_TIMEOUT_MS = 4_000;

let state: UpdateState = INITIAL_UPDATE_STATE;
const listeners = new Set<() => void>();
let registration: ServiceWorkerRegistration | undefined;
let skipWaiting: (() => Promise<void>) | undefined;

function dispatch(event: UpdateEvent) {
  const next = reduceUpdate(state, event);
  if (next === state) return;
  state = next;
  for (const listener of listeners) listener();
}

function appScope() {
  return new URL('/', location.href).href;
}

async function checkRemoteVersion() {
  try {
    const response = await fetch(new URL('/version.json', location.href), {
      cache: 'no-store',
    });
    if (!response.ok) return;
    dispatch({
      type: 'version',
      check: compareVersion(__APP_VERSION__, await response.json()),
    });
  } catch {
    return;
  }
}

async function checkRegistration() {
  if (!registration) return;
  try {
    await registration.update();
  } catch {
    return;
  }
}

/** Looks for a new build: at launch, when the app comes back to the front, and on a timer. */
export function checkForUpdate() {
  return Promise.all([checkRegistration(), checkRemoteVersion()]);
}

export function startUpdater() {
  skipWaiting = registerSW({
    immediate: true,
    onRegisteredSW: (_url, registered) => {
      registration = registered;
      void checkRegistration();
    },
    onNeedRefresh: () => dispatch({ type: 'sw-waiting' }),
    onRegisterError: (error: unknown) => {
      console.warn('Service worker registration failed', error);
    },
  });
  void checkRemoteVersion();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void checkForUpdate();
  });
  setInterval(() => {
    if (document.visibilityState === 'visible') void checkForUpdate();
  }, CHECK_INTERVAL_MS);
}

/**
 * Drops the app's service worker and caches, then reloads: the next launch
 * downloads the current build. Data on the device is never touched.
 */
export async function forceUpdate() {
  if (state.forcing === 'forcing') return;
  dispatch({ type: 'force', state: 'forcing' });
  try {
    const scope = appScope();
    const registrations =
      'serviceWorker' in navigator
        ? await navigator.serviceWorker.getRegistrations()
        : [];
    await Promise.all(
      registrations
        .filter((candidate) => candidate.scope === scope)
        .map((candidate) => candidate.unregister()),
    );
    const keys = 'caches' in window ? await caches.keys() : [];
    await Promise.all(
      keys
        .filter((key) => isAppCache(key, scope))
        .map((key) => caches.delete(key)),
    );
    location.reload();
  } catch (error) {
    console.warn('Forced update failed', error);
    dispatch({ type: 'force', state: 'failed' });
  }
}

/**
 * Switches to the waiting build and reloads once it controls the page.
 * Without a waiting worker, or if it never takes over, falls back to a
 * forced update so the tap always ends on the new version.
 */
export async function applyUpdate() {
  if (!registration?.waiting || !skipWaiting) {
    await forceUpdate();
    return;
  }
  const tookOver = new Promise<boolean>((resolve) => {
    navigator.serviceWorker.addEventListener(
      'controllerchange',
      () => {
        location.reload();
        resolve(true);
      },
      { once: true },
    );
    setTimeout(() => resolve(false), TAKEOVER_TIMEOUT_MS);
  });
  await skipWaiting();
  if (!(await tookOver)) await forceUpdate();
}

/** Hides the update toast until released, e.g. for the length of a batch. */
export function holdUpdates() {
  dispatch({ type: 'hold' });
  let released = false;
  return () => {
    if (released) return;
    released = true;
    dispatch({ type: 'release' });
  };
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => state;

export function useUpdate() {
  const current = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return {
    available: current.available,
    offered: offersUpdate(current),
    forcing: current.forcing,
  };
}
