import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  applyCorners,
  CORNER_RADII,
  CORNER_TILES,
  DEFAULT_CORNERS,
  isCornerRadius,
  type CornerRoot,
} from '#foundations/corners';

const css = readFileSync(resolve(import.meta.dirname, '../styles.css'), 'utf8');

const presetsIn = (attribute: string) =>
  [...css.matchAll(new RegExp(`:root\\[${attribute}='([a-z]+)'\\]`, 'g'))].map(
    (match) => match[1],
  );

describe('corner presets', () => {
  it('lists every radius preset the stylesheet declares, plus the default', () => {
    const declared = new Set([
      ...presetsIn('data-radius'),
      DEFAULT_CORNERS.radius,
    ]);
    expect(new Set(CORNER_RADII.map((preset) => preset.value))).toEqual(
      declared,
    );
  });

  it('lists every tiles preset the stylesheet declares, plus the default', () => {
    const declared = new Set([
      ...presetsIn('data-tiles'),
      DEFAULT_CORNERS.tiles,
    ]);
    expect(new Set(CORNER_TILES.map((preset) => preset.value))).toEqual(
      declared,
    );
  });

  it('recognises a preset and rejects the rest', () => {
    expect(isCornerRadius('doux')).toBe(true);
    expect(isCornerRadius('ovale')).toBe(false);
    expect(isCornerRadius(undefined)).toBe(false);
  });
});

describe('applyCorners', () => {
  it('removes both attributes for the defaults, so the stylesheet values apply', () => {
    const root: CornerRoot = { dataset: { radius: 'carre', tiles: 'rondes' } };
    applyCorners(root, DEFAULT_CORNERS);
    expect(root.dataset).toEqual({});
  });

  it('writes a chosen preset on the root', () => {
    const root: CornerRoot = { dataset: {} };
    applyCorners(root, { radius: 'doux', tiles: 'rondes' });
    expect(root.dataset).toEqual({ radius: 'doux', tiles: 'rondes' });
  });
});
