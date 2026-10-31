import { type Context, Hono } from 'hono';

/** Better Auth's admin API ignores companies: the app calls it from the server, never over HTTP. */
export function isClosedAuthPath(pathname: string): boolean {
  const path = pathname.replace(/\/{2,}/g, '/').toLowerCase();
  return path === '/api/auth/admin' || path.startsWith('/api/auth/admin/');
}

export function authRoutes(
  handle: (c: Context) => Response | Promise<Response>,
): Hono {
  const routes = new Hono();
  routes.on(['GET', 'POST'], '/*', (c) =>
    isClosedAuthPath(c.req.path) ? c.notFound() : handle(c),
  );
  return routes;
}
