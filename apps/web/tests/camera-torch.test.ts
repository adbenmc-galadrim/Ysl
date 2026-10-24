import { describe, expect, it, vi } from 'vitest';
import { applyTorch, torchCapability } from '#/features/camera/torch';

const track = (capabilities: object, settings: object = {}) => ({
  getCapabilities: () => capabilities as MediaTrackCapabilities,
  getSettings: () => settings as MediaTrackSettings,
});

describe('torchCapability', () => {
  it('finds no torch without a track, or on a track that offers none', () => {
    expect(torchCapability(undefined)).toBe('none');
    expect(torchCapability(track({}))).toBe('none');
    expect(torchCapability(track({ torch: false }))).toBe('none');
    expect(
      torchCapability({
        getSettings: () => ({}),
      } as unknown as MediaStreamTrack),
    ).toBe('none');
  });

  it('reads whether the torch is lit from the settings', () => {
    expect(torchCapability(track({ torch: true }, { torch: true }))).toBe('on');
    expect(torchCapability(track({ torch: true }, { torch: false }))).toBe(
      'off',
    );
    expect(torchCapability(track({ torch: true }))).toBe('off');
  });
});

describe('applyTorch', () => {
  it('asks in an advanced constraint, as iOS takes it', async () => {
    const applyConstraints = vi.fn().mockResolvedValue(undefined);
    await applyTorch({ applyConstraints }, true);
    expect(applyConstraints).toHaveBeenCalledWith({
      advanced: [{ torch: true }],
    });
    await applyTorch({ applyConstraints }, false);
    expect(applyConstraints).toHaveBeenLastCalledWith({
      advanced: [{ torch: false }],
    });
  });
});
