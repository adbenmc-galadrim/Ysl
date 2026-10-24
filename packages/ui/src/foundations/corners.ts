/**
 * The corner presets of `styles.css`, from the squarest to the roundest. The
 * mockups sit just before the last one; it is the default and needs no
 * attribute on `<html>`.
 */
export const CORNER_RADII = [
  { value: 'carre', title: 'Carrés', detail: '0 px' },
  { value: 'leger', title: 'Légers', detail: '4 à 12 px, sans pilules' },
  { value: 'doux', title: 'Doux', detail: '6 à 16 px, sans pilules' },
  { value: 'maquettes', title: 'Maquettes', detail: 'pilules, 14 à 24 px' },
  {
    value: 'arrondi',
    title: 'Pilules',
    detail: 'tout en pilules, 24 à 32 px',
  },
] as const;

export type CornerRadius = (typeof CORNER_RADII)[number]['value'];

/** The round marks — icon squares, avatars — follow the preset, or stay round. */
export const CORNER_TILES = [
  { value: 'auto', title: 'Pastilles selon les arrondis' },
  { value: 'rondes', title: 'Pastilles toujours rondes' },
] as const;

export type CornerTiles = (typeof CORNER_TILES)[number]['value'];

export type CornerSetting = { radius: CornerRadius; tiles: CornerTiles };

export const DEFAULT_CORNERS: CornerSetting = {
  radius: 'maquettes',
  tiles: 'auto',
};

export function isCornerRadius(value: unknown): value is CornerRadius {
  return CORNER_RADII.some((preset) => preset.value === value);
}

export function isCornerTiles(value: unknown): value is CornerTiles {
  return CORNER_TILES.some((preset) => preset.value === value);
}

/** What `applyCorners` needs of `<html>`: enough for a test without a DOM. */
export type CornerRoot = { dataset: { radius?: string; tiles?: string } };

/**
 * Writes the preset on the root element as `data-radius` / `data-tiles`,
 * which the CSS presets of `styles.css` key on. The defaults remove the
 * attributes rather than naming them, so the stylesheet's own values apply.
 */
export function applyCorners(root: CornerRoot, setting: CornerSetting) {
  if (setting.radius === DEFAULT_CORNERS.radius) delete root.dataset.radius;
  else root.dataset.radius = setting.radius;
  if (setting.tiles === DEFAULT_CORNERS.tiles) delete root.dataset.tiles;
  else root.dataset.tiles = setting.tiles;
}
