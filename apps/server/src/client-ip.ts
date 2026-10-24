export interface ClientIpSource {
  socketAddress: string | undefined;
  forwardedFor: string | undefined;
  trustProxy: boolean;
}

export function clientIp({
  socketAddress,
  forwardedFor,
  trustProxy,
}: ClientIpSource): string {
  if (trustProxy && forwardedFor) {
    const proxied = forwardedFor.split(',').at(-1)?.trim();
    if (proxied) return proxied;
  }
  return socketAddress ?? '';
}
