const BASE = 'http://internal.invalid';

export function safeRedirect(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.startsWith('/')) return undefined;
  let url: URL;
  try {
    url = new URL(value, BASE);
  } catch {
    return undefined;
  }
  if (url.origin !== BASE) return undefined;
  return `${url.pathname}${url.search}${url.hash}`;
}
