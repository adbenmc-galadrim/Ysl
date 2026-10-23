export function displayHost(url: string) {
  const { host, pathname } = new URL(url);
  return `${host}${pathname}`.replace(/\/+$/, '');
}
