import { describe, expect, it } from 'vitest';
import { cameraFailure } from '#/features/camera/stream';

describe('cameraFailure', () => {
  it('reads a refusal as denied', () => {
    expect(cameraFailure(new DOMException('no', 'NotAllowedError'))).toBe(
      'denied',
    );
    expect(cameraFailure(new DOMException('no', 'SecurityError'))).toBe(
      'denied',
    );
  });

  it('reads a missing or busy camera as blocked', () => {
    expect(cameraFailure(new DOMException('none', 'NotFoundError'))).toBe(
      'blocked',
    );
    expect(cameraFailure(new DOMException('busy', 'NotReadableError'))).toBe(
      'blocked',
    );
    expect(cameraFailure(new Error('boom'))).toBe('blocked');
    expect(cameraFailure(undefined)).toBe('blocked');
  });
});
