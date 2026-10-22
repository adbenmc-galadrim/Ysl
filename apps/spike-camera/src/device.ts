import type { Device } from '#/metrics/journal';

export function readDevice(): Device {
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return {
    userAgent: navigator.userAgent,
    standalone,
    imageCapture: 'ImageCapture' in window,
    opfs: typeof navigator.storage?.getDirectory === 'function',
    screen: `${screen.width}×${screen.height} @${window.devicePixelRatio}x`,
  };
}
