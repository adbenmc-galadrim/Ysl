import { afterEach, describe, expect, it, vi } from 'vitest';
import { shareFile } from '#/lib/share-file';

const file = new File(['{}'], 'secours.json', { type: 'application/json' });

function download() {
  const anchor = {
    href: '',
    download: '',
    click: vi.fn(),
    remove: vi.fn(),
  };
  const host = {
    document: {
      createElement: vi.fn(() => anchor),
      body: { append: vi.fn() },
    } as unknown as Document,
    URL: {
      createObjectURL: vi.fn(() => 'blob:secours'),
      revokeObjectURL: vi.fn(),
    },
  };
  return { anchor, host };
}

describe('shareFile', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens the share sheet when the browser takes files', async () => {
    const share = vi.fn(() => Promise.resolve());
    const { host, anchor } = download();
    const outcome = await shareFile(file, 'Export', {
      ...host,
      navigator: { canShare: () => true, share },
    });
    expect(outcome).toBe('shared');
    expect(share).toHaveBeenCalledWith({ files: [file], title: 'Export' });
    expect(anchor.click).not.toHaveBeenCalled();
  });

  it('says the sheet was refused when WebKit wants a fresh touch', async () => {
    const refused = new Error('not allowed');
    refused.name = 'NotAllowedError';
    const { host, anchor } = download();
    const outcome = await shareFile(file, 'Export', {
      ...host,
      navigator: { canShare: () => true, share: () => Promise.reject(refused) },
    });
    expect(outcome).toBe('blocked');
    expect(anchor.click).not.toHaveBeenCalled();
  });

  it('treats a closed sheet as a cancellation, not a failure', async () => {
    const abort = new Error('closed');
    abort.name = 'AbortError';
    const { host } = download();
    const outcome = await shareFile(file, 'Export', {
      ...host,
      navigator: { canShare: () => true, share: () => Promise.reject(abort) },
    });
    expect(outcome).toBe('cancelled');
    await expect(
      shareFile(file, 'Export', {
        ...host,
        navigator: {
          canShare: () => true,
          share: () => Promise.reject(new Error('boom')),
        },
      }),
    ).rejects.toThrow('boom');
  });

  it('downloads the file when sharing files is not offered, and frees the URL later', async () => {
    vi.useFakeTimers();
    const { host, anchor } = download();
    const outcome = await shareFile(file, 'Export', {
      ...host,
      navigator: { share: vi.fn() },
    });
    expect(outcome).toBe('downloaded');
    expect(anchor.download).toBe('secours.json');
    expect(anchor.href).toBe('blob:secours');
    expect(anchor.click).toHaveBeenCalledOnce();
    expect(host.URL.revokeObjectURL).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(host.URL.revokeObjectURL).toHaveBeenCalledWith('blob:secours');

    const refused = download();
    expect(
      await shareFile(file, 'Export', {
        ...refused.host,
        navigator: { canShare: () => false, share: vi.fn() },
      }),
    ).toBe('downloaded');
  });
});
