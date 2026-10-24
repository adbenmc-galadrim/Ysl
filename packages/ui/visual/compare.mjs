/**
 * Pixel comparison of every screen story against its reference: the Penpot
 * export, or a Storybook capture where the JSON says `"source": "storybook"`.
 *
 *   pnpm visual                      # all screens, Storybook on :6006
 *   pnpm visual -- --port 6101 --filter colis
 *   pnpm visual -- --max 0.8         # tolerate up to 0.8 % of differing pixels
 *
 * A screen story opts in with `parameters.reference`, the path of its export
 * under `reference/` without extension. Each run writes, per screen, the
 * capture, a diff mask and a side-by-side sheet to `visual/out/`, and prints
 * the share of pixels that differ. Exports are 2x, so captures are too.
 *
 * The run fails (exit code 1) when a screen differs by more than `--max`
 * percent, or when no screen was compared at all. In GitHub Actions the table
 * also lands in the job summary.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import pixelmatch from 'pixelmatch';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

import { markdown, parseMax, verdict } from './report.mjs';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const { values: args } = parseArgs({
  options: {
    port: { type: 'string', default: '6006' },
    filter: { type: 'string', default: '' },
    threshold: { type: 'string', default: '0.1' },
    max: { type: 'string', default: '0.6' },
  },
});
const max = parseMax(args.max);

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
  // The stylesheet is fetched after the root renders: a capture taken before
  // the network settles is unstyled, and differs by several percent.
  await page.goto(`${base}/iframe.html?id=${story.id}&viewMode=story`, {
    waitUntil: 'networkidle',
  });
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

const { ok, failed } = verdict(results, max);
if (process.env.GITHUB_STEP_SUMMARY)
  fs.appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `## Comparaison visuelle\n\n${markdown(results, max)}`,
  );
if (!ok) {
  for (const r of failed)
    console.error(`✗ ${r.ref}: ${r.pct.toFixed(2)} % > ${max} %`);
  process.exitCode = 1;
}
