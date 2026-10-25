import { describe, expect, it, vi } from 'vitest';
import {
  applyTrackZoom,
  cameraZoom,
  clampZoom,
  DIGITAL_ZOOM_MAX,
  pinchZoom,
  ZOOM_MAX,
  zoomCrop,
  zoomLabel,
  zoomRange,
} from '#/features/camera/zoom';

const track = (capabilities: object) => ({
  getCapabilities: () => capabilities as MediaTrackCapabilities,
  applyConstraints: vi.fn().mockResolvedValue(undefined),
});

describe('zoomRange', () => {
  it('falls back to our digital zoom when the track offers none', () => {
    const digital = { kind: 'digital', min: 1, max: DIGITAL_ZOOM_MAX };
    expect(zoomRange(undefined)).toMatchObject(digital);
    expect(zoomRange(track({}))).toMatchObject(digital);
    expect(zoomRange(track({ zoom: { min: 1, max: 1 } }))).toMatchObject(
      digital,
    );
  });

  it("takes the camera's own zoom, capped where reading stops gaining", () => {
    expect(zoomRange(track({ zoom: { min: 1, max: 123, step: 0.1 } }))).toEqual(
      { kind: 'track', min: 1, max: ZOOM_MAX, step: 0.1 },
    );
    expect(zoomRange(track({ zoom: { min: 1, max: 5 } }))).toEqual({
      kind: 'track',
      min: 1,
      max: 5,
      step: 0,
    });
  });
});

describe('pinchZoom', () => {
  const range = { min: 1, max: 4, step: 0.1 };

  it('follows the spread of the fingers from the level on screen', () => {
    expect(pinchZoom(1, 100, 200, range)).toBe(2);
    expect(pinchZoom(2, 100, 150, range)).toBe(3);
    expect(pinchZoom(3, 200, 100, range)).toBe(1.5);
  });

  it('stays within the range, on its steps', () => {
    expect(pinchZoom(1, 100, 1000, range)).toBe(4);
    expect(pinchZoom(2, 100, 10, range)).toBe(1);
    expect(pinchZoom(1, 100, 123, range)).toBe(1.2);
    expect(pinchZoom(2, 0, 50, range)).toBe(2);
    expect(clampZoom(2.37, { min: 1, max: 8, step: 0 })).toBe(2.37);
  });
});

describe('zoomLabel', () => {
  it('writes the level the French way', () => {
    expect(zoomLabel(1)).toBe('×1,0');
    expect(zoomLabel(2.46)).toBe('×2,5');
  });
});

describe('zoomCrop', () => {
  it('keeps the whole frame at ×1', () => {
    expect(zoomCrop(4032, 3024, 1)).toEqual({
      x: 0,
      y: 0,
      width: 4032,
      height: 3024,
    });
  });

  it('keeps the middle the screen enlarges', () => {
    expect(zoomCrop(4000, 3000, 2)).toEqual({
      x: 1000,
      y: 750,
      width: 2000,
      height: 1500,
    });
  });
});

describe('cameraZoom', () => {
  it('asks the camera in an advanced constraint, as iOS takes it', async () => {
    const camera = track({ zoom: { min: 1, max: 10, step: 0.5 } });
    await applyTrackZoom(camera, 2);
    expect(camera.applyConstraints).toHaveBeenCalledWith({
      advanced: [{ zoom: 2 }],
    });
  });

  it('opens at ×1 on the track, and crops only for the digital zoom', async () => {
    const camera = track({ zoom: { min: 1, max: 10, step: 0.5 } });
    cameraZoom.reset(camera);
    cameraZoom.set(3.2);
    expect(cameraZoom.level).toBe(3);
    expect(cameraZoom.digital).toBe(1);
    cameraZoom.reset(camera);
    expect(cameraZoom.level).toBe(1);
    await vi.waitFor(() =>
      expect(camera.applyConstraints).toHaveBeenLastCalledWith({
        advanced: [{ zoom: 1 }],
      }),
    );

    cameraZoom.reset(track({}));
    cameraZoom.set(2.5);
    expect(cameraZoom.digital).toBe(2.5);
    cameraZoom.reset(undefined);
    expect(cameraZoom.digital).toBe(1);
  });
});
