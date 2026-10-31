import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { authRoutes, isClosedAuthPath } from '#auth-routes';

describe('isClosedAuthPath', () => {
  it.each([
    '/api/auth/admin/set-role',
    '/api/auth/admin/list-users',
    '/api/auth//admin/set-role',
    '/api/auth/ADMIN/set-role',
    '/api/auth/admin',
  ])('closes %s', (path) => {
    expect(isClosedAuthPath(path)).toBe(true);
  });

  it.each([
    '/api/auth/sign-in/email',
    '/api/auth/get-session',
    '/api/auth/administration',
  ])('leaves %s open', (path) => {
    expect(isClosedAuthPath(path)).toBe(false);
  });
});

describe('authRoutes', () => {
  const mount = () => {
    const handle = vi.fn(() => new Response('ok'));
    return { handle, app: new Hono().route('/api/auth', authRoutes(handle)) };
  };

  it('never hands a role change to Better Auth', async () => {
    const { app, handle } = mount();
    const response = await app.request('/api/auth/admin/set-role', {
      method: 'POST',
    });
    expect(response.status).toBe(404);
    expect(handle).not.toHaveBeenCalled();
  });

  it('hands the sign-in to Better Auth', async () => {
    const { app, handle } = mount();
    const response = await app.request('/api/auth/sign-in/email', {
      method: 'POST',
    });
    expect(response.status).toBe(200);
    expect(handle).toHaveBeenCalledOnce();
  });
});
