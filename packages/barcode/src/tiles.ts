import type { Quad, Raster, Symbol } from '#zxing';

export const MAX_CANVAS_PIXELS = 16_777_216;

export type Rect = { x: number; y: number; width: number; height: number };

export type TileOptions = {
  tileSize?: number;
  overlap?: number;
};

const axis = (length: number, size: number, overlap: number) => {
  if (length <= size) return [0];
  const count = Math.ceil((length - overlap) / (size - overlap));
  const stride = (length - size) / (count - 1);
  return Array.from({ length: count }, (_, i) => Math.round(i * stride));
};

export const planTiles = (
  width: number,
  height: number,
  { tileSize = 2048, overlap = 512 }: TileOptions = {},
): Rect[] => {
  const cap = Math.floor(Math.sqrt(MAX_CANVAS_PIXELS));
  const size = Math.max(2, Math.min(tileSize, cap));
  const gap = Math.min(overlap, Math.floor(size / 2));
  const xs = axis(width, size, gap);
  const ys = axis(height, size, gap);
  return ys.flatMap((y) =>
    xs.map((x) => ({
      x,
      y,
      width: Math.min(size, width - x),
      height: Math.min(size, height - y),
    })),
  );
};

export const cropRaster = (raster: Raster, rect: Rect): Raster => {
  const data = new Uint8ClampedArray(rect.width * rect.height * 4);
  for (let row = 0; row < rect.height; row++) {
    const start = ((rect.y + row) * raster.width + rect.x) * 4;
    data.set(
      raster.data.subarray(start, start + rect.width * 4),
      row * rect.width * 4,
    );
  }
  return { data, width: rect.width, height: rect.height };
};

const corners = (q: Quad) => [
  q.topLeft,
  q.topRight,
  q.bottomRight,
  q.bottomLeft,
];

export const offsetSymbol = (
  symbol: Symbol,
  dx: number,
  dy: number,
): Symbol => {
  const move = (p: { x: number; y: number }) => ({ x: p.x + dx, y: p.y + dy });
  return {
    ...symbol,
    position: {
      topLeft: move(symbol.position.topLeft),
      topRight: move(symbol.position.topRight),
      bottomRight: move(symbol.position.bottomRight),
      bottomLeft: move(symbol.position.bottomLeft),
    },
  };
};

const bounds = (q: Quad) => {
  const xs = corners(q).map((p) => p.x);
  const ys = corners(q).map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return {
    cx: (minX + Math.max(...xs)) / 2,
    cy: (minY + Math.max(...ys)) / 2,
    size: Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY),
  };
};

export const dedupeSymbols = (symbols: Symbol[]): Symbol[] => {
  const kept: Symbol[] = [];
  for (const symbol of symbols) {
    const a = bounds(symbol.position);
    const twin = kept.findIndex((other) => {
      if (other.format !== symbol.format || other.text !== symbol.text) {
        return false;
      }
      const b = bounds(other.position);
      return Math.hypot(a.cx - b.cx, a.cy - b.cy) < Math.max(a.size, b.size);
    });
    if (twin === -1) kept.push(symbol);
    else if (a.size > bounds(kept[twin]!.position).size) kept[twin] = symbol;
  }
  return kept;
};

export type RasterReader = (raster: Raster) => Promise<Symbol[]>;

export const readTiles = async (
  raster: Raster,
  read: RasterReader,
  options: TileOptions = {},
): Promise<Symbol[]> => {
  const found: Symbol[] = [];
  for (const rect of planTiles(raster.width, raster.height, options)) {
    const tile =
      rect.width === raster.width && rect.height === raster.height
        ? raster
        : cropRaster(raster, rect);
    const symbols = await read(tile);
    found.push(...symbols.map((s) => offsetSymbol(s, rect.x, rect.y)));
  }
  return dedupeSymbols(found);
};
