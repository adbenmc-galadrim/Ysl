import { describe, expect, it } from 'vitest';
import { clientIp } from '#client-ip';

const socketAddress = '10.0.1.5';

describe('clientIp', () => {
  it('ignores X-Forwarded-For when the proxy is not trusted', () => {
    expect(
      clientIp({ socketAddress, forwardedFor: '1.2.3.4', trustProxy: false }),
    ).toBe(socketAddress);
  });

  it('takes the entry appended by the proxy, not the one sent by the client', () => {
    expect(
      clientIp({
        socketAddress,
        forwardedFor: '6.6.6.6, 203.0.113.7',
        trustProxy: true,
      }),
    ).toBe('203.0.113.7');
  });

  it('falls back to the socket when the trusted proxy sends no header', () => {
    expect(
      clientIp({ socketAddress, forwardedFor: undefined, trustProxy: true }),
    ).toBe(socketAddress);
    expect(
      clientIp({ socketAddress, forwardedFor: ' , ', trustProxy: true }),
    ).toBe(socketAddress);
  });
});
