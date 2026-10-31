import { describe, expect, it } from 'vitest';
import { logoRoute } from '#logo-route';

const ID = '0190f0f0-0000-7000-8000-000000000001';

const app = logoRoute({
  read: (id) =>
    Promise.resolve(
      id === ID
        ? { bytes: Buffer.from([1, 2, 3]), contentType: 'image/png' }
        : null,
    ),
});

describe('logoRoute', () => {
  it('serves the bytes under their checked type, for any origin, without a session', async () => {
    const response = await app.request(`/${ID}`);
    expect(response.status).toBe(200);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(
      new Uint8Array([1, 2, 3]),
    );
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('cross-origin-resource-policy')).toBe(
      'cross-origin',
    );
    expect(response.headers.get('content-security-policy')).toContain(
      'sandbox',
    );
  });

  it('answers 404 for an unknown logo, and never reads a malformed id', async () => {
    expect((await app.request(`/${ID.replace('1', '2')}`)).status).toBe(404);
    expect((await app.request("/x'%20or%201=1")).status).toBe(404);
  });
});
