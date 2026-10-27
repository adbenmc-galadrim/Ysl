import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startPurgeJob } from '#purge-job';

vi.mock('@repo/shared/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('purge job', () => {
  it('runs a minute after start, then at every interval, and stops', async () => {
    const run = vi.fn().mockResolvedValue({ status: 'done' });
    const stop = startPurgeJob({ intervalMinutes: 60, run });

    await vi.advanceTimersByTimeAsync(59_000);
    expect(run).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60 * 60_000);
    expect(run).toHaveBeenCalledTimes(2);

    stop();
    await vi.advanceTimersByTimeAsync(2 * 60 * 60_000);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('keeps going after a failed run, and never starts one while another is going', async () => {
    let finish: (value: { status: 'done' }) => void = () => undefined;
    const run = vi
      .fn()
      .mockRejectedValueOnce(new Error('database down'))
      .mockImplementation(
        () =>
          new Promise<{ status: 'done' }>((resolve) => {
            finish = resolve;
          }),
      );
    const stop = startPurgeJob({ intervalMinutes: 1, run, firstDelayMs: 0 });

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(run).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(run).toHaveBeenCalledTimes(2);
    finish({ status: 'done' });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(run).toHaveBeenCalledTimes(3);
    stop();
  });

  it('does nothing at 0', async () => {
    const run = vi.fn();
    startPurgeJob({ intervalMinutes: 0, run });
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(run).not.toHaveBeenCalled();
  });
});
