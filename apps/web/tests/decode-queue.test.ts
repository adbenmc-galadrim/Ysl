import { describe, expect, it } from 'vitest';
import { DecodeQueue } from '#/features/scan/decode-queue';

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('DecodeQueue', () => {
  it('holds the third grab until a slot is given back', async () => {
    const queue = new DecodeQueue(() => Promise.reject(new Error()), 2);
    await queue.acquire();
    await queue.acquire();
    let third = false;
    const waiting = queue.acquire().then(() => {
      third = true;
    });
    await settle();
    expect(third).toBe(false);
    expect(queue.pending).toBe(3);

    queue.release();
    await waiting;
    expect(third).toBe(true);
    expect(queue.pending).toBe(2);
  });
});
