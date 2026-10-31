import { Hono } from 'hono';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type LogoRouteOptions = {
  read: (id: string) => Promise<{ bytes: Buffer; contentType: string } | null>;
};

/**
 * A company's logo, for the app and for e-mail clients, which have no session.
 * Any origin may show it (`require-corp` on the app); the browser may neither
 * guess another type nor run anything from it. A new logo is a new address.
 */
export function logoRoute({ read }: LogoRouteOptions): Hono {
  const route = new Hono();
  route.get('/:id', async (c) => {
    const id = c.req.param('id');
    const file = UUID.test(id) ? await read(id) : null;
    if (!file) return c.body(null, 404);
    return c.body(new Uint8Array(file.bytes), 200, {
      'Content-Type': file.contentType,
      'Content-Disposition': 'inline',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'X-Content-Type-Options': 'nosniff',
    });
  });
  return route;
}
