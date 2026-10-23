export type DisplayContext = {
  userAgent: string;
  maxTouchPoints: number;
  standalone: boolean | undefined;
  displayModeStandalone: boolean;
};

const IOS_DEVICE = /iPhone|iPad|iPod/;
const DESKTOP_SAFARI_ON_IPAD = /Macintosh/;

function isIosDevice({ userAgent, maxTouchPoints }: DisplayContext) {
  return (
    IOS_DEVICE.test(userAgent) ||
    (DESKTOP_SAFARI_ON_IPAD.test(userAgent) && maxTouchPoints > 1)
  );
}

export function isIosBrowserTab(context: DisplayContext) {
  if (!isIosDevice(context)) return false;
  return context.standalone !== true && !context.displayModeStandalone;
}

export function currentDisplayContext(): DisplayContext {
  return {
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
    standalone: (navigator as Navigator & { standalone?: boolean }).standalone,
    displayModeStandalone: window.matchMedia('(display-mode: standalone)')
      .matches,
  };
}
