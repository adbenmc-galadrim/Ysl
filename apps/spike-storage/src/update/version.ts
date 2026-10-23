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

export type Fetcher = (
  url: string,
  init: { cache: 'no-store' },
) => Promise<Pick<Response, 'ok' | 'json'>>;

export async function checkVersion(
  local: string,
  url: string,
  fetcher: Fetcher = fetch,
): Promise<VersionCheck> {
  try {
    const response = await fetcher(url, { cache: 'no-store' });
    if (!response.ok) return { kind: 'unknown' };
    return compareVersion(local, await response.json());
  } catch {
    return { kind: 'unknown' };
  }
}
