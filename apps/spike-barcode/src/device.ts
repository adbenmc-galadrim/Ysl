export type Device = Record<string, string | number | boolean>;

export const readDevice = (): Device => {
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return {
    userAgent: navigator.userAgent,
    standalone,
    imageCapture: 'ImageCapture' in window,
    offscreenCanvas: typeof OffscreenCanvas !== 'undefined',
    barcodeDetector: 'BarcodeDetector' in window,
    screen: `${screen.width}×${screen.height} @${window.devicePixelRatio}x`,
  };
};
