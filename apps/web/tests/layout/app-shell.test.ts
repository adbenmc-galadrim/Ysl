import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import viteReact from '@vitejs/plugin-react';
import { type Browser, chromium, type Page, webkit } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * The app frame on a 390 × 844 iPhone, with the safe areas of a Dynamic
 * Island: the bottom bar stays on screen above the home indicator, and the
 * last row of a long list scrolls into view above it. Chromium by default,
 * `LAYOUT_BROWSER=webkit` for Safari's engine.
 *
 * What only iOS does — a viewport that starts under an opaque status bar
 * while `lvh` keeps the full screen — no desktop engine reproduces; the frame
 * is held to the dynamic viewport instead (`followsDynamicViewport`).
 */
const VIEWPORT = { width: 390, height: 844 };
const SAFE = { top: 59, bottom: 34 };

let server: ViteDevServer;
let browser: Browser;
let base: string;

beforeAll(async () => {
  server = await createServer({
    configFile: false,
    // The app's root, so Tailwind scans `src` as it does for the app.
    root: fileURLToPath(new URL('../..', import.meta.url)),
    logLevel: 'error',
    plugins: [tailwindcss(), viteReact()],
    resolve: { tsconfigPaths: true },
    server: { port: 0, host: '127.0.0.1' },
  });
  await server.listen();
  base = new URL('tests/layout/fixture/', server.resolvedUrls!.local[0]).href;
  const engine = process.env.LAYOUT_BROWSER === 'webkit' ? webkit : chromium;
  browser = await engine.launch();
}, 60_000);

afterAll(async () => {
  await browser?.close();
  await server?.close();
});

async function open(query: string): Promise<Page> {
  const page = await browser.newPage({ viewport: VIEWPORT });
  await page.goto(`${base}?${query}`);
  await page.addStyleTag({
    content: `:root{--safe-top:${SAFE.top}px;--safe-bottom:${SAFE.bottom}px}`,
  });
  await page.locator('[data-shell=app]').waitFor();
  return page;
}

/** Bottom edge of the area a thumb can reach: above the home indicator. */
const usableBottom = VIEWPORT.height - SAFE.bottom;

async function bottomOf(page: Page, name: string): Promise<number> {
  const box = await page.getByRole('button', { name }).boundingBox();
  if (!box) throw new Error(`${name} is not rendered`);
  return box.y + box.height;
}

/**
 * Height declarations of the CSS rules that size the frame, conditional ones
 * included: a `@media (display-mode: standalone)` variant never applies in
 * Playwright, and may come out nested in its rule.
 */
function frameHeights(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const frame = document.querySelector('[data-shell=app]')!;
    const heights: string[] = [];
    const walk = (rules: CSSRuleList, inFrame: boolean) => {
      for (const rule of rules) {
        let matches = inFrame;
        if (rule instanceof CSSStyleRule) {
          try {
            matches = frame.matches(rule.selectorText);
          } catch {
            // A nested selector (`&…`) that `matches` cannot parse.
          }
        }
        const { style } = rule as Partial<CSSStyleRule>;
        if (matches && style?.height) heights.push(style.height);
        if ('cssRules' in rule) {
          walk((rule as CSSGroupingRule).cssRules, matches);
        }
      }
    };
    for (const sheet of document.styleSheets) walk(sheet.cssRules, false);
    return heights;
  });
}

describe('app frame', () => {
  it('follows the dynamic viewport, never the large or small one', async () => {
    const page = await open('screen=colis&count=2');
    const heights = await frameHeights(page);
    expect(heights).not.toHaveLength(0);
    for (const height of heights) expect(height).toMatch(/dvh/);
    const frame = await page.locator('[data-shell=app]').boundingBox();
    expect(frame!.y).toBe(0);
    expect(frame!.height).toBeCloseTo(VIEWPORT.height, 0);
    await page.close();
  });

  it('keeps the Colis bottom bar on screen with a short list', async () => {
    const page = await open('screen=colis&count=2');
    for (const name of ['Rechercher', 'Remettre', 'Scanner']) {
      expect(await bottomOf(page, name)).toBeLessThanOrEqual(usableBottom);
    }
    await page.close();
  });

  it('scrolls a long Colis list to its last row above the bar', async () => {
    const page = await open('screen=colis&count=20');
    const scanner = page.getByRole('button', { name: 'Scanner' });
    expect(await bottomOf(page, 'Scanner')).toBeLessThanOrEqual(usableBottom);

    const last = page.getByText('Colis 20', { exact: true });
    await page.mouse.move(VIEWPORT.width / 2, VIEWPORT.height / 2);
    for (let i = 0; i < 10; i += 1) await page.mouse.wheel(0, 600);
    await expect
      .poll(async () => (await last.boundingBox())?.y ?? Infinity)
      .toBeLessThan(VIEWPORT.height);
    const row = await last.boundingBox();
    const bar = await scanner.boundingBox();
    expect(row!.y + row!.height).toBeLessThanOrEqual(bar!.y);
    // The list scrolled, not the document.
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await page.close();
  });

  it('draws only the rows in view of a very long list, down to the last', async () => {
    const page = await open('screen=colis&count=500');
    const rows = page.locator('[data-index]');
    expect(await rows.count()).toBeLessThan(40);

    const scroller = page.locator('main').locator('..');
    await scroller.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    const last = page.getByText('Colis 500', { exact: true });
    await expect
      .poll(async () => (await last.boundingBox())?.y ?? Infinity)
      .toBeLessThan(VIEWPORT.height);
    const row = await last.boundingBox();
    const bar = await page
      .getByRole('button', { name: 'Scanner' })
      .boundingBox();
    expect(row!.y + row!.height).toBeLessThanOrEqual(bar!.y);
    expect(await rows.count()).toBeLessThan(40);
    await page.close();
  });

  it('keeps the Remise actions above the home indicator', async () => {
    const page = await open('screen=remise');
    for (const name of ['Taper le code', 'Chercher un nom']) {
      expect(await bottomOf(page, name)).toBeLessThanOrEqual(usableBottom);
    }
    await page.close();
  });
});
