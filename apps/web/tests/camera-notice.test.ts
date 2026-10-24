import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { describe, expect, it } from 'vitest';
import { cameraReading } from '#/features/camera/notice';

const t = createTranslator(DEFAULT_LOCALE);

describe('cameraReading', () => {
  it('says nothing while the camera films', () => {
    expect(cameraReading('live', false, t)).toBeNull();
    expect(cameraReading('live', true, t)).toBeNull();
  });

  it('tells a refusal apart from a failure', () => {
    expect(cameraReading('denied', false, t)).toMatchObject({
      kind: 'blocked',
      title: 'Caméra refusée',
    });
    expect(cameraReading('blocked', false, t)).toMatchObject({
      kind: 'blocked',
      title: 'iOS a bloqué la caméra',
    });
  });

  it('reads idle as starting, or as off in fallback', () => {
    expect(cameraReading('idle', false, t)).toEqual({
      kind: 'starting',
      title: 'Activation…',
    });
    expect(cameraReading('starting', true, t)).toEqual({
      kind: 'starting',
      title: 'Activation…',
    });
    expect(cameraReading('idle', true, t)).toMatchObject({
      kind: 'blocked',
      title: 'Caméra non activée',
      retry: 'Activer la caméra',
    });
  });
});
