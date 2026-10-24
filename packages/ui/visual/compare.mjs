/**
 * Pixel comparison of every screen story against its Penpot export.
 *
 *   pnpm visual                      # all screens, Storybook on :6006
 *   pnpm visual -- --port 6101 --filter colis
 *
 * A screen story opts in with `parameters.reference`, the path of its export
 * under `reference/` without extension. Each run writes, per screen, the
 * capture, a diff mask and a side-by-side sheet to `visual/out/`, and prints
 * the share of pixels that differ. Exports are 2x, so captures are too.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import pixelmatch from 'pixelmatch';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const { values: args } = parseArgs({
  options: {
    port: { type: 'string', default: '6006' },
    filter: { type: 'string', default: '' },
    threshold: { type: 'string', default: '0.1' },
  },
});

const base = `http://localhost:${args.port}`;
const out = path.join(root, 'visual', 'out');
fs.mkdirSync(out, { recursive: true });

const index = await fetch(`${base}/index.json`).then((r) => r.json());
const stories = Object.values(index.entries).filter(
  (e) =>
    e.type === 'story' &&
    e.title.startsWith('Écrans/') &&
    // Ids keep the accents of the titles; the filter is matched without.
    e.id
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .includes(args.filter.toLowerCase()),
);

const browser = await chromium.launch();
const results = [];

for (const story of stories) {
  // The reference fixes the viewport, so it is read before the real capture.
  const probe = await browser.newPage();
  await probe.goto(`${base}/iframe.html?id=${story.id}&viewMode=story`);
  await probe.waitForFunction(
    () => window.__STORYBOOK_PREVIEW__?.currentRender?.story,
    null,
    { timeout: 60_000 },
  );
  const ref = await probe.evaluate(
    () => window.__STORYBOOK_PREVIEW__.currentRender.story.parameters.reference,
  );
  await probe.close();
  if (!ref) continue;

  const expected = PNG.sync.read(
    fs.readFileSync(path.join(root, 'reference', `${ref}.png`)),
  );
  const { width, height } = expected;
  const context = await browser.newContext({
    viewport: { width: width / 2, height: height / 2 },
    deviceScaleFactor: 2,
    // The landing plays its scenes on scroll; reduced motion freezes them in their final state.
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  await page.goto(`${base}/iframe.html?id=${story.id}&viewMode=story`);
  await page.waitForSelector('#storybook-root > *', { timeout: 60_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  const actual = PNG.sync.read(await page.screenshot());
  await context.close();

  const diff = new PNG({ width, height });
  const mismatched = pixelmatch(
    expected.data,
    actual.data,
    diff.data,
    width,
    height,
    { threshold: Number(args.threshold) },
  );

  // Reference | capture | diff, so a glance shows what moved.
  const sheet = new PNG({ width: width * 3, height });
  for (const [i, img] of [expected, actual, diff].entries())
    PNG.bitblt(img, sheet, 0, 0, width, height, i * width, 0);
  const name = ref.replaceAll('/', '__');
  fs.writeFileSync(path.join(out, `${name}.png`), PNG.sync.write(actual));
  fs.writeFileSync(path.join(out, `${name}.sheet.png`), PNG.sync.write(sheet));

  const pct = (mismatched / (width * height)) * 100;
  results.push({ story: story.id, ref, pct });
  console.log(`${pct.toFixed(2).padStart(6)} %  ${ref}  (${story.id})`);
}

await browser.close();
fs.writeFileSync(
  path.join(out, 'report.json'),
  JSON.stringify(results, null, 2),
);
if (!results.length) console.log('No screen story matched.');
