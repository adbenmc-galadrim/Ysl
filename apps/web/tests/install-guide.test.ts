import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const DOCS = fileURLToPath(new URL('../../../docs/', import.meta.url));
const GUIDE = readFileSync(`${DOCS}installation-iphone.md`, 'utf8');
const IMAGES = 'images/installation/';

/** Headings as GitHub anchors them: lower case, punctuation dropped, spaces as dashes. */
function anchor(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s/g, '-');
}

const prose = GUIDE.replace(/```[\s\S]*?```/g, '');
const headings = [...prose.matchAll(/^#{1,6} (.+)$/gm)].map((m) =>
  anchor(m[1]!),
);
const links = [...prose.matchAll(/(!?)\[[^\]]*\]\(([^)\s]+)\)/g)].map((m) => ({
  image: m[1] === '!',
  target: m[2]!,
}));

describe('the iPhone installation guide', () => {
  it('shows images that are all in the repository, and only those', () => {
    const shown = links.filter((link) => link.image).map((l) => l.target);
    for (const target of shown)
      expect(existsSync(DOCS + target), target).toBe(true);
    const stored = readdirSync(DOCS + IMAGES).map((name) => IMAGES + name);
    expect([...new Set(shown)].sort()).toEqual(stored.sort());
  });

  it('links to sections that exist and to files that exist', () => {
    for (const { image, target } of links) {
      if (image || /^https?:/.test(target)) continue;
      const [path, hash] = target.split('#');
      if (path) expect(existsSync(DOCS + path), target).toBe(true);
      if (hash && !path) expect(headings, target).toContain(hash);
    }
  });

  it('keeps its code fences closed and the sections the service relies on', () => {
    expect((GUIDE.match(/^```/gm) ?? []).length % 2).toBe(0);
    expect(headings).toEqual(
      expect.arrayContaining([
        'avant-de-commencer',
        'en-cas-de-perte-ou-de-vol',
        'changer-diphone-ou-réinstaller',
        'dépannage',
        'vérification',
      ]),
    );
  });
});
