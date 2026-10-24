import { afterEach, describe, expect, it, vi } from 'vitest';
import { IMPORT_MAX_SIDE, readImageFile } from '#/features/scan/read-file';

type Fake = ImageBitmap & { closed: boolean };

const bitmap = (width: number, height: number): Fake => {
  const fake = {
    width,
    height,
    closed: false,
    close() {
      fake.closed = true;
    },
  };
  return fake;
};

const file = new Blob(['photo'], { type: 'image/jpeg' });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('readImageFile', () => {
  it('brings a 48 Mpx photo down to the stream, and frees the big one', async () => {
    const full = bitmap(8064, 6048);
    const small = bitmap(4032, 3024);
    const create = vi
      .fn<typeof createImageBitmap>()
      .mockResolvedValueOnce(full)
      .mockResolvedValueOnce(small);
    vi.stubGlobal('createImageBitmap', create);

    await expect(readImageFile(file)).resolves.toBe(small);
    expect(create).toHaveBeenNthCalledWith(1, file, {
      imageOrientation: 'from-image',
    });
    expect(create).toHaveBeenNthCalledWith(2, full, {
      resizeWidth: 4032,
      resizeHeight: 3024,
      resizeQuality: 'high',
    });
    expect(full.closed).toBe(true);
    expect(small.closed).toBe(false);
  });

  it('keeps a photo of the stream size as it is, without a copy', async () => {
    const full = bitmap(3024, IMPORT_MAX_SIDE);
    const create = vi.fn<typeof createImageBitmap>().mockResolvedValue(full);
    vi.stubGlobal('createImageBitmap', create);

    await expect(readImageFile(file)).resolves.toBe(full);
    expect(create).toHaveBeenCalledTimes(1);
    expect(full.closed).toBe(false);
  });

  it('frees the big one even when the smaller copy fails', async () => {
    const full = bitmap(8064, 6048);
    const create = vi
      .fn<typeof createImageBitmap>()
      .mockResolvedValueOnce(full)
      .mockRejectedValueOnce(new Error('out of memory'));
    vi.stubGlobal('createImageBitmap', create);

    await expect(readImageFile(file)).rejects.toThrow('out of memory');
    expect(full.closed).toBe(true);
  });
});
