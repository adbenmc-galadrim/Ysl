import { describe, expect, it, vi } from 'vitest';
import { mailWebhook } from '#mail-webhook';

const TOKEN = 'a'.repeat(32);

function post(
  app: ReturnType<typeof mailWebhook>,
  authorization: string | undefined,
  body = '{"event":"delivered","message-id":"<a@x>"}',
) {
  return app.request('/', {
    method: 'POST',
    headers: authorization ? { authorization } : {},
    body,
  });
}

describe('mailWebhook', () => {
  it('hands the event over and answers what the handler says', async () => {
    const receive = vi.fn().mockResolvedValue(429);
    const response = await post(
      mailWebhook({ token: TOKEN, receive }),
      `Bearer ${TOKEN}`,
    );

    expect(response.status).toBe(429);
    expect(receive).toHaveBeenCalledWith({
      event: 'delivered',
      'message-id': '<a@x>',
    });
  });

  it.each([
    ['missing', undefined],
    ['wrong', `Bearer ${'b'.repeat(32)}`],
    ['of another length', `Bearer ${TOKEN}a`],
  ])('refuses a token %s and writes nothing', async (_, authorization) => {
    const receive = vi.fn();
    const response = await post(
      mailWebhook({ token: TOKEN, receive }),
      authorization,
    );

    expect(response.status).toBe(401);
    expect(receive).not.toHaveBeenCalled();
  });

  it('stays off without a token', async () => {
    const receive = vi.fn();
    const response = await post(
      mailWebhook({ token: undefined, receive }),
      'Bearer ',
    );

    expect(response.status).toBe(404);
    expect(receive).not.toHaveBeenCalled();
  });

  it('passes a body that is not JSON on as nothing', async () => {
    const receive = vi.fn().mockResolvedValue(400);
    const response = await post(
      mailWebhook({ token: TOKEN, receive }),
      `Bearer ${TOKEN}`,
      'not json',
    );

    expect(response.status).toBe(400);
    expect(receive).toHaveBeenCalledWith(null);
  });
});
