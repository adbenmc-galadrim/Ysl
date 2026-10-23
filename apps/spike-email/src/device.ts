import type { Device } from '#/journal';

export function readDevice(): Device {
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return {
    userAgent: navigator.userAgent,
    standalone,
    share: typeof navigator.share === 'function',
    canShareFiles: typeof navigator.canShare === 'function',
    screen: `${screen.width}×${screen.height} @${window.devicePixelRatio}x`,
  };
}
