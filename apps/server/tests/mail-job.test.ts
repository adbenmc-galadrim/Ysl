import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startMailJob } from '#mail-job';

vi.mock('@repo/shared/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

const DONE = { sent: 0, retry: 0, failed: 0 };

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('mail job', () => {
  it('keeps going after a failed run, and never overlaps a run', async () => {
    let finish: (value: typeof DONE) => void = () => undefined;
    const run = vi
      .fn()
      .mockRejectedValueOnce(new Error('database down'))
      .mockImplementation(
        () =>
          new Promise<typeof DONE>((resolve) => {
            finish = resolve;
          }),
      );
    const stop = startMailJob({ intervalSeconds: 30, run });

    await vi.advanceTimersByTimeAsync(30_000);
    expect(run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(run).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(run).toHaveBeenCalledTimes(2);

    finish(DONE);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(run).toHaveBeenCalledTimes(3);

    stop();
    finish(DONE);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(run).toHaveBeenCalledTimes(3);
  });

  it('stays off at 0', async () => {
    const run = vi.fn();
    startMailJob({ intervalSeconds: 0, run });
    await vi.advanceTimersByTimeAsync(120_000);
    expect(run).not.toHaveBeenCalled();
  });
});
