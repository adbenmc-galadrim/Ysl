export function displayHost(url: string) {
  const { host, pathname } = new URL(url);
  return `${host}${pathname}`.replace(/\/+$/, '');
}

/** `__APP_VERSION__` is the build's ISO timestamp; its date reads as a calendar version. */
export function displayVersion(builtAt: string) {
  return builtAt.slice(0, 10).replaceAll('-', '.');
}
