import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const DOCS = fileURLToPath(new URL('../../../docs/', import.meta.url));
const GUIDES = join(DOCS, 'guides');
const IMAGES = join(DOCS, 'images', 'guides');

const guides = readdirSync(GUIDES)
  .filter((name) => name.endsWith('.md'))
  .map((name) => ({
    name,
    path: join(GUIDES, name),
    text: readFileSync(join(GUIDES, name), 'utf8'),
  }));

/** Headings as GitHub anchors them: lower case, punctuation dropped, spaces as dashes. */
function anchor(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s/g, '-');
}

const prose = (text: string) => text.replace(/```[\s\S]*?```/g, '');

function headingsOf(path: string): string[] {
  return [...prose(readFileSync(path, 'utf8')).matchAll(/^#{1,6} (.+)$/gm)].map(
    (m) => anchor(m[1]!),
  );
}

function linksOf(text: string) {
  return [...prose(text).matchAll(/(!?)\[[^\]]*\]\(([^)\s]+)\)/g)].map((m) => ({
    image: m[1] === '!',
    target: m[2]!,
  }));
}

describe('the role guides', () => {
  it('show images that are all in the repository, and store only those', () => {
    const shown = new Set<string>();
    for (const guide of guides) {
      for (const { image, target } of linksOf(guide.text)) {
        if (!image) continue;
        const file = normalize(join(GUIDES, target));
        expect(existsSync(file), `${guide.name} : ${target}`).toBe(true);
        shown.add(file);
      }
    }
    const stored = readdirSync(IMAGES).map((name) => join(IMAGES, name));
    expect([...shown].sort()).toEqual(stored.sort());
  });

  it('link to files and sections that exist', () => {
    for (const guide of guides) {
      for (const { image, target } of linksOf(guide.text)) {
        if (image || /^https?:/.test(target)) continue;
        const [path, hash] = target.split('#');
        const file = path ? normalize(join(dirname(guide.path), path)) : guide.path;
        expect(existsSync(file), `${guide.name} : ${target}`).toBe(true);
        if (hash && file.endsWith('.md'))
          expect(headingsOf(file), `${guide.name} : ${target}`).toContain(
            decodeURIComponent(hash),
          );
      }
    }
  });

  it('name no real address and no client brand (public repository, D14)', () => {
    for (const guide of guides) {
      const addresses = guide.text.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g) ?? [];
      for (const address of addresses)
        expect(address, guide.name).toMatch(/@(exemple\.fr|example\.com)$/);
      expect(guide.text, guide.name).not.toMatch(/saint.?laurent|\bysl\b|shinseo/i);
    }
  });
});
