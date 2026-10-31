import { type Context, Hono } from 'hono';

/** Better Auth's admin API ignores companies: the app calls it from the server, never over HTTP. */
export function isClosedAuthPath(pathname: string): boolean {
  const path = pathname.replace(/\/{2,}/g, '/').toLowerCase();
  return path === '/api/auth/admin' || path.startsWith('/api/auth/admin/');
}

/** The session lookup answers "suspended" to the device; a new sign-in is refused by the admin plugin, or for a company by the session hook. */
const OPEN_WHEN_SUSPENDED = new Set([
  '/api/auth/get-session',
  '/api/auth/sign-in/email',
]);

export function authRoutes(
  handle: (c: Context) => Response | Promise<Response>,
  suspensionOf: (headers: Headers) => Promise<string | null> = () =>
    Promise.resolve(null),
): Hono {
  const routes = new Hono();
  routes.on(['GET', 'POST'], '/*', async (c) => {
    if (isClosedAuthPath(c.req.path)) return c.notFound();
    // Signing out or closing its sessions would also empty the suspended phone.
    const path = c.req.path.replace(/\/{2,}/g, '/').toLowerCase();
    if (!OPEN_WHEN_SUSPENDED.has(path)) {
      const code = await suspensionOf(c.req.raw.headers);
      if (code) return c.json({ code }, 403);
    }
    return handle(c);
  });
  return routes;
}
