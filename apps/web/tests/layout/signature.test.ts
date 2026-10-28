import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import viteReact from '@vitejs/plugin-react';
import { type Browser, chromium, type Page, webkit } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

/**
 * The signature pad under a pointer, in a real browser: a drawn line comes
 * out as a PNG with ink in it, and the page stays still while drawing.
 * Chromium by default, `LAYOUT_BROWSER=webkit` for Safari's engine.
 */
let server: ViteDevServer;
let browser: Browser;
let base: string;

beforeAll(async () => {
  server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL('../..', import.meta.url)),
    cacheDir: 'node_modules/.vite-layout-signature',
    logLevel: 'error',
    plugins: [tailwindcss(), viteReact()],
    resolve: { tsconfigPaths: true },
    server: { port: 0, host: '127.0.0.1' },
  });
  await server.listen();
  base = new URL('tests/layout/signature/', server.resolvedUrls!.local[0]).href;
  const engine = process.env.LAYOUT_BROWSER === 'webkit' ? webkit : chromium;
  browser = await engine.launch();
}, 60_000);

afterAll(async () => {
  await browser?.close();
  await server?.close();
});

async function open(): Promise<Page> {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(base);
  await page.getByRole('img', { name: 'Signez avec le doigt' }).waitFor();
  return page;
}

/** How far the page and its scrolling boxes have scrolled, all told. */
const scrolled = (page: Page) =>
  page.evaluate(
    () =>
      window.scrollY +
      [...document.querySelectorAll('*')].reduce(
        (sum, node) => sum + node.scrollTop + node.scrollLeft,
        0,
      ),
  );

async function draw(page: Page) {
  const pad = page.getByRole('img', { name: 'Signez avec le doigt' });
  const box = (await pad.boundingBox())!;
  await page.mouse.move(box.x + 60, box.y + box.height * 0.6);
  await page.mouse.down();
  for (let i = 1; i <= 24; i++) {
    await page.mouse.move(
      box.x + 60 + i * 10,
      box.y + box.height * 0.6 + Math.sin(i / 2) * 40 + i * 4,
    );
  }
  await page.mouse.up();
}

describe('signature pad', () => {
  it('turns a drawn line into a smooth stroke and a PNG with ink in it', async () => {
    const page = await open();
    const confirm = page.getByRole('button', { name: 'Valider la signature' });
    expect(await confirm.isDisabled()).toBe(true);

    await draw(page);
    const strokes = (await page.evaluate(() => window.__strokes)) ?? [];
    expect(strokes).toHaveLength(1);
    expect(strokes[0]).toMatch(/^M[\d.,-]+Q/);
    await confirm.click();
    await page.waitForFunction(() => window.__signature);
    const png = (await page.evaluate(() => window.__signature))!;

    expect(png.bytes).toBeGreaterThan(200);
    expect(png.bytes).toBeLessThan(20_000);
    expect(png.width).toBeGreaterThan(400);
    expect(png.inked).toBeGreaterThan(1000);
    await page.close();
  });

  it('keeps the page still under the finger and clears on « Effacer »', async () => {
    const page = await open();
    const pad = page.getByRole('img', { name: 'Signez avec le doigt' });
    expect(
      await pad.evaluate((node) => getComputedStyle(node).touchAction),
    ).toBe('none');
    const before = await scrolled(page);

    await draw(page);

    expect(await scrolled(page)).toBe(before);
    await page.getByRole('button', { name: 'Effacer' }).click();
    expect(await page.evaluate(() => window.__strokes)).toEqual([]);
    await page.close();
  });
});
