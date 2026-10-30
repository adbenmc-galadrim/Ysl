export type VersionCheck =
  | { kind: 'same'; remote: string }
  | { kind: 'different'; remote: string }
  | { kind: 'unknown' };

export function compareVersion(local: string, payload: unknown): VersionCheck {
  if (typeof payload !== 'object' || payload === null) {
    return { kind: 'unknown' };
  }
  const remote = (payload as { version?: unknown }).version;
  if (typeof remote !== 'string' || remote === '') {
    return { kind: 'unknown' };
  }
  return { kind: remote === local ? 'same' : 'different', remote };
}

/**
 * The retired spikes left service workers under `/spike-…/` on the iPhones that
 * ran them: their Workbox caches carry that scope, the app's the bare origin.
 */
export function isAppCache(key: string, scope: string): boolean {
  const at = key.indexOf(scope);
  if (at === -1) return false;
  return !key.slice(at + scope.length).startsWith('spike-');
}

export type ForceState = 'idle' | 'forcing' | 'failed';

export type UpdateState = {
  available: boolean;
  forcing: ForceState;
  held: number;
};

export const INITIAL_UPDATE_STATE: UpdateState = {
  available: false,
  forcing: 'idle',
  held: 0,
};

export type UpdateEvent =
  | { type: 'version'; check: VersionCheck }
  | { type: 'sw-waiting' }
  | { type: 'force'; state: ForceState }
  | { type: 'hold' }
  | { type: 'release' };

export function reduceUpdate(
  state: UpdateState,
  event: UpdateEvent,
): UpdateState {
  switch (event.type) {
    case 'version':
      if (event.check.kind === 'unknown') return state;
      return {
        ...state,
        available: state.available || event.check.kind === 'different',
      };
    case 'sw-waiting':
      return { ...state, available: true };
    case 'force':
      return { ...state, forcing: event.state };
    case 'hold':
      return { ...state, held: state.held + 1 };
    case 'release':
      return { ...state, held: Math.max(0, state.held - 1) };
  }
}

/** Whether the "new version" toast may show: never while a batch holds it. */
export function offersUpdate(state: UpdateState): boolean {
  return state.available && state.held === 0;
}
