import { describe, expect, it } from 'vitest';
import { shutterMode } from '#/features/camera/shutter';

describe('shutterMode', () => {
  it('takes a frame of the stream while it films', () => {
    expect(shutterMode('live', false)).toBe('grab');
    expect(shutterMode('live', true)).toBe('grab');
  });

  it('opens the native camera when the stream will not come', () => {
    expect(shutterMode('denied', false)).toBe('native');
    expect(shutterMode('blocked', false)).toBe('native');
    expect(shutterMode('idle', true)).toBe('native');
  });

  it('stays quiet while the stream is starting', () => {
    expect(shutterMode('idle', false)).toBe('none');
    expect(shutterMode('starting', false)).toBe('none');
    expect(shutterMode('starting', true)).toBe('none');
  });
});
