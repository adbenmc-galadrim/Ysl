import type { Device } from '#/journal';

export function readDevice(): Device {
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return {
    userAgent: navigator.userAgent,
    standalone,
    share: typeof navigator.share === 'function',
    canShareFiles:
      navigator.canShare?.({
        files: [new File([''], 'test.png', { type: 'image/png' })],
      }) === true,
    screen: `${screen.width}×${screen.height} @${window.devicePixelRatio}x`,
  };
}
