import { describe, expect, it } from 'vitest';
import {
  isIosBrowserTab,
  type DisplayContext,
} from '#/features/install/browser-tab';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1';
const MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15';

const context = (overrides: Partial<DisplayContext>): DisplayContext => ({
  userAgent: IPHONE,
  maxTouchPoints: 5,
  standalone: false,
  displayModeStandalone: false,
  ...overrides,
});

describe('isIosBrowserTab', () => {
  it('asks to install when the app is opened in a Safari tab on an iPhone', () => {
    expect(isIosBrowserTab(context({}))).toBe(true);
  });

  it('lets the installed app through, whichever signal iOS gives', () => {
    expect(isIosBrowserTab(context({ standalone: true }))).toBe(false);
    expect(
      isIosBrowserTab(
        context({ standalone: undefined, displayModeStandalone: true }),
      ),
    ).toBe(false);
  });

  it('leaves a computer alone', () => {
    expect(
      isIosBrowserTab(
        context({ userAgent: MAC, maxTouchPoints: 0, standalone: undefined }),
      ),
    ).toBe(false);
  });

  it('asks an iPad to install even though Safari presents it as a Mac', () => {
    expect(
      isIosBrowserTab(context({ userAgent: MAC, maxTouchPoints: 5 })),
    ).toBe(true);
  });
});
