import type { RasterReader } from '#tiles';
import type { Raster, Symbol } from '#zxing';

export type Bullseye = {
  x: number;
  y: number;
  unit: number;
  score: number;
  shape?: Shape;
};

export type Shape = [number, number, number, number];

export type Straightened = {
  raster: Raster;
  bullseye: Bullseye;
  rotation: number;
};

export type MaxiCodeRead = {
  symbols: Symbol[];
  bullseye: Bullseye;
  rotation: number;
  candidates: number;
};

type Gray = { data: Uint8Array; width: number; height: number };

const SPAN_UNITS = { left: 19.94, right: 21.31, top: 19.06, bottom: 18.44 };
const SPAN_WIDTH = SPAN_UNITS.left + SPAN_UNITS.right;
const SPAN_HEIGHT = SPAN_UNITS.top + SPAN_UNITS.bottom;
const LATTICE_PHASE = 0;
const RING_PATTERN = [1, 1, 1, 1, 1, 1.6, 1, 1, 1, 1, 1];
const RING_SAMPLES = [
  { radius: 0.4, dark: false },
  { radius: 1.3, dark: true },
  { radius: 2.3, dark: false },
  { radius: 3.3, dark: true },
  { radius: 4.3, dark: false },
  { radius: 5.3, dark: true },
];
const BAND_SAMPLES = [-0.32, 0, 0.32].flatMap((offset) =>
  RING_SAMPLES.filter((s) => s.radius > 1).map((s) => ({
    radius: s.radius + offset,
    dark: s.dark,
  })),
);
const SCORE_THRESHOLD = 0.9;
const QUICK_THRESHOLD = 0.6;
const SKEW_THRESHOLD = 0.88;
const MAX_WORK_SIDE = 2400;
const SIXTY_DEGREES = Math.PI / 3;

export const toGray = (raster: Raster): Gray => {
  const { data, width, height } = raster;
  const out = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < out.length; i++, p += 4) {
    out[i] =
      (data[p]! * 306 + data[p + 1]! * 601 + data[p + 2]! * 117 + 512) >> 10;
  }
  return { data: out, width, height };
};

const boxDownscale = (gray: Gray, factor: number): Gray => {
  if (factor <= 1) return gray;
  const width = Math.floor(gray.width / factor);
  const height = Math.floor(gray.height / factor);
  const out = new Uint8Array(width * height);
  const area = factor * factor;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let dy = 0; dy < factor; dy++) {
        const row = (y * factor + dy) * gray.width + x * factor;
        for (let dx = 0; dx < factor; dx++) sum += gray.data[row + dx]!;
      }
      out[y * width + x] = Math.round(sum / area);
    }
  }
  return { data: out, width, height };
};

const binarize = (gray: Gray, windowHalf?: number): Uint8Array => {
  const { data, width, height } = gray;
  const stride = width + 1;
  const integral = new Float64Array(stride * (height + 1));
  for (let y = 0; y < height; y++) {
    let row = 0;
    for (let x = 0; x < width; x++) {
      row += data[y * width + x]!;
      integral[(y + 1) * stride + x + 1] = integral[y * stride + x + 1]! + row;
    }
  }
  const half =
    windowHalf ?? Math.max(8, Math.round(Math.max(width, height) / 48));
  const dark = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - half);
    const y1 = Math.min(height, y + half + 1);
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - half);
      const x1 = Math.min(width, x + half + 1);
      const sum =
        integral[y1 * stride + x1]! -
        integral[y0 * stride + x1]! -
        integral[y1 * stride + x0]! +
        integral[y0 * stride + x0]!;
      const mean = sum / ((x1 - x0) * (y1 - y0));
      dark[y * width + x] = data[y * width + x]! < mean * 0.85 ? 1 : 0;
    }
  }
  return dark;
};

type Run = { start: number; length: number; dark: boolean };

const rowCandidates = (
  dark: Uint8Array,
  width: number,
  y: number,
): { x: number; unit: number }[] => {
  const runs: Run[] = [];
  let start = 0;
  for (let x = 1; x <= width; x++) {
    if (x === width || dark[y * width + x] !== dark[y * width + start]) {
      runs.push({
        start,
        length: x - start,
        dark: dark[y * width + start] === 1,
      });
      start = x;
    }
  }
  const found: { x: number; unit: number }[] = [];
  const total = RING_PATTERN.reduce((a, b) => a + b, 0);
  for (let i = 0; i + RING_PATTERN.length <= runs.length; i++) {
    if (!runs[i]!.dark) continue;
    const window = runs.slice(i, i + RING_PATTERN.length);
    const span =
      window.at(-1)!.start + window.at(-1)!.length - window[0]!.start;
    const unit = span / total;
    if (unit < 1.5) continue;
    const fits = window.every((run, k) => {
      const ratio = run.length / (RING_PATTERN[k]! * unit);
      return ratio > 0.55 && ratio < 1.7;
    });
    if (fits) found.push({ x: window[0]!.start + span / 2, unit });
  }
  return found;
};

const sampleDark = (dark: Uint8Array, gray: Gray, x: number, y: number) => {
  const ix = Math.round(x);
  const iy = Math.round(y);
  if (ix < 0 || iy < 0 || ix >= gray.width || iy >= gray.height) return null;
  return dark[iy * gray.width + ix] === 1;
};

const radialScore = (
  dark: Uint8Array,
  gray: Gray,
  cx: number,
  cy: number,
  unit: number,
  samples: { radius: number; dark: boolean }[] = RING_SAMPLES,
) => {
  let good = 0;
  let count = 0;
  for (let a = 0; a < 24; a++) {
    const angle = (a * 2 * Math.PI) / 24;
    for (const sample of samples) {
      const value = sampleDark(
        dark,
        gray,
        cx + Math.cos(angle) * sample.radius * unit,
        cy + Math.sin(angle) * sample.radius * unit,
      );
      if (value === null) return 0;
      count++;
      if (value === sample.dark) good++;
    }
  }
  return good / count;
};

const refine = (
  dark: Uint8Array,
  gray: Gray,
  seed: { x: number; y: number; unit: number },
): Bullseye => {
  let best: Bullseye = { ...seed, score: 0 };
  for (const scale of [0.85, 0.92, 1, 1.08, 1.15]) {
    const unit = seed.unit * scale;
    const step = Math.max(0.5, unit * 0.15);
    for (let dy = -unit; dy <= unit; dy += step) {
      for (let dx = -unit; dx <= unit; dx += step) {
        const score = radialScore(dark, gray, seed.x + dx, seed.y + dy, unit);
        if (score > best.score) {
          best = { x: seed.x + dx, y: seed.y + dy, unit, score };
        }
      }
    }
  }
  return best;
};

const RING_FIT_RADIUS = 3.8;
const MIN_ELONGATION = 1.08;
const RING_RAYS = 72;
const RING_MIN_POINTS = 24;
const MAX_ELONGATION = 2.6;

const ringEdge = (
  dark: Uint8Array,
  gray: Gray,
  seed: { x: number; y: number; unit: number },
  angle: number,
) => {
  const step = 0.25;
  const limit = seed.unit * 8;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const minRun = seed.unit * 0.3;
  let rings = 0;
  let wasDark = false;
  let runStart = 0;
  for (let r = 0; r <= limit; r += step) {
    const value = sampleDark(dark, gray, seed.x + cos * r, seed.y + sin * r);
    if (value === null) return null;
    if (value === wasDark) continue;
    if (wasDark && r - runStart >= minRun) {
      rings++;
      if (rings === 2) return { x: cos * r, y: sin * r };
    }
    wasDark = value;
    runStart = r;
  }
  return null;
};

const solve = (matrix: number[][], rhs: number[]): number[] | null => {
  const n = rhs.length;
  const m = matrix.map((row, i) => [...row, rhs[i]!]);
  for (let c = 0; c < n; c++) {
    let pivot = c;
    for (let r = c + 1; r < n; r++) {
      if (Math.abs(m[r]![c]!) > Math.abs(m[pivot]![c]!)) pivot = r;
    }
    if (Math.abs(m[pivot]![c]!) < 1e-12) return null;
    [m[c], m[pivot]] = [m[pivot]!, m[c]!];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const factor = m[r]![c]! / m[c]![c]!;
      for (let k = c; k <= n; k++) m[r]![k]! -= factor * m[c]![k]!;
    }
  }
  return m.map((row, i) => row[n]! / row[i]!);
};

const fitConic = (points: { x: number; y: number }[]) => {
  const scale = Math.max(...points.map((p) => Math.hypot(p.x, p.y)));
  const terms = points.map(({ x, y }) => {
    const u = x / scale;
    const v = y / scale;
    return [u * u, u * v, v * v, u, v];
  });
  const normal = Array.from({ length: 5 }, (_, i) =>
    Array.from({ length: 5 }, (_, j) =>
      terms.reduce((sum, t) => sum + t[i]! * t[j]!, 0),
    ),
  );
  const rhs = Array.from({ length: 5 }, (_, i) =>
    terms.reduce((sum, t) => sum + t[i]!, 0),
  );
  const fit = solve(normal, rhs);
  if (!fit) return null;
  const [a, b, c, d, e] = fit as [number, number, number, number, number];
  const det = 4 * a * c - b * b;
  if (a <= 0 || det <= 0) return null;
  const cx = (b * e - 2 * c * d) / det;
  const cy = (b * d - 2 * a * e) / det;
  const k = 1 - (a * cx * cx + b * cx * cy + c * cy * cy + d * cx + e * cy);
  const off = b / 2;
  const mid = (a + c) / 2;
  const spread = Math.hypot((a - c) / 2, off);
  const low = mid - spread;
  const high = mid + spread;
  if (low <= 0 || k <= 0) return null;
  const theta = 0.5 * Math.atan2(b, a - c);
  return {
    x: cx * scale,
    y: cy * scale,
    long: Math.sqrt(k / low) * scale,
    short: Math.sqrt(k / high) * scale,
    theta: theta + Math.PI / 2,
  };
};

export const fitRing = (
  dark: Uint8Array,
  gray: Gray,
  seed: { x: number; y: number; unit: number },
): { x: number; y: number; unit: number; shape: Shape } | null => {
  let points = Array.from({ length: RING_RAYS }, (_, i) =>
    ringEdge(dark, gray, seed, (i * 2 * Math.PI) / RING_RAYS),
  ).filter((p) => p !== null);
  for (let round = 0; round < 3; round++) {
    if (points.length < RING_MIN_POINTS) return null;
    const conic = fitConic(points);
    if (!conic) return null;
    const cos = Math.cos(conic.theta);
    const sin = Math.sin(conic.theta);
    const residual = (p: { x: number; y: number }) => {
      const dx = p.x - conic.x;
      const dy = p.y - conic.y;
      const along = (dx * cos + dy * sin) / conic.long;
      const across = (dy * cos - dx * sin) / conic.short;
      return Math.abs(Math.hypot(along, across) - 1);
    };
    const kept = points.filter((p) => residual(p) < 0.1);
    if (kept.length === points.length || round === 2) {
      if (conic.long / conic.short > MAX_ELONGATION) return null;
      const long = conic.long / RING_FIT_RADIUS;
      const short = conic.short / RING_FIT_RADIUS;
      return {
        x: seed.x + conic.x,
        y: seed.y + conic.y,
        unit: Math.sqrt(long * short),
        shape: [
          long * cos * cos + short * sin * sin,
          (long - short) * cos * sin,
          (long - short) * cos * sin,
          long * sin * sin + short * cos * cos,
        ],
      };
    }
    points = kept;
  }
  return null;
};

const ellipseScore = (
  dark: Uint8Array,
  gray: Gray,
  ring: { x: number; y: number; shape: Shape },
) => {
  const [a, b, c, d] = ring.shape;
  let good = 0;
  let count = 0;
  for (let i = 0; i < 24; i++) {
    const angle = (i * 2 * Math.PI) / 24;
    for (const sample of RING_SAMPLES) {
      const u = Math.cos(angle) * sample.radius;
      const v = Math.sin(angle) * sample.radius;
      const value = sampleDark(
        dark,
        gray,
        ring.x + a * u + b * v,
        ring.y + c * u + d * v,
      );
      if (value === null) return 0;
      count++;
      if (value === sample.dark) good++;
    }
  }
  return good / count;
};

const fine = (dark: Uint8Array, gray: Gray, start: Bullseye): Bullseye => {
  const tried: Bullseye[] = [];
  const reach = start.unit * 0.5;
  const step = Math.max(0.25, start.unit * 0.1);
  for (let scale = 0.9; scale <= 1.1001; scale += 0.01) {
    const unit = start.unit * scale;
    for (let dy = -reach; dy <= reach; dy += step) {
      for (let dx = -reach; dx <= reach; dx += step) {
        const x = start.x + dx;
        const y = start.y + dy;
        tried.push({
          x,
          y,
          unit,
          score: radialScore(dark, gray, x, y, unit, BAND_SAMPLES),
        });
      }
    }
  }
  const top = Math.max(...tried.map((t) => t.score));
  const plateau = tried.filter((t) => t.score >= top - 0.005);
  return {
    x: mean(plateau.map((t) => t.x)),
    y: mean(plateau.map((t) => t.y)),
    unit: mean(plateau.map((t) => t.unit)),
    score: start.score,
  };
};

type Cluster = { xs: number[]; ys: number[]; units: number[] };

const cluster = (hits: { x: number; y: number; unit: number }[]) => {
  const clusters: Cluster[] = [];
  for (const hit of hits) {
    const home = clusters.find((c) => {
      const cx = c.xs.reduce((a, b) => a + b, 0) / c.xs.length;
      const cy = c.ys.at(-1)!;
      return Math.abs(cx - hit.x) < hit.unit * 1.5 && hit.y - cy <= 3;
    });
    if (home) {
      home.xs.push(hit.x);
      home.ys.push(hit.y);
      home.units.push(hit.unit);
    } else {
      clusters.push({ xs: [hit.x], ys: [hit.y], units: [hit.unit] });
    }
  }
  return clusters;
};

const mean = (values: number[]) =>
  values.reduce((a, b) => a + b, 0) / values.length;

const findAt = (gray: Gray, maxCandidates: number): Bullseye[] => {
  const dark = binarize(gray);
  const hits: { x: number; y: number; unit: number }[] = [];
  for (let y = 0; y < gray.height; y++) {
    for (const c of rowCandidates(dark, gray.width, y)) {
      hits.push({ x: c.x, y, unit: c.unit });
    }
  }
  const seeds = cluster(hits)
    .map((c) => ({
      rows: c.ys.length,
      span: Math.max(...c.ys) - Math.min(...c.ys) + 1,
      x: mean(c.xs),
      y: (Math.min(...c.ys) + Math.max(...c.ys)) / 2,
      unit: mean(c.units),
    }))
    .filter((c) => c.rows >= 3 && c.span <= c.unit * 6)
    .map((c) => ({ ...c, quick: radialScore(dark, gray, c.x, c.y, c.unit) }))
    .filter((c) => c.quick >= QUICK_THRESHOLD)
    .sort((a, b) => b.quick - a.quick)
    .slice(0, maxCandidates);
  const found: Bullseye[] = [];
  for (const seed of seeds) {
    const coarse = refine(dark, gray, seed);
    const ring = fitRing(dark, gray, coarse.score > 0 ? coarse : seed);
    const skew = ring ? ellipseScore(dark, gray, ring) : 0;
    if (coarse.score < SCORE_THRESHOLD && skew < SKEW_THRESHOLD) continue;
    const b: Bullseye =
      ring && skew > coarse.score
        ? {
            x: ring.x,
            y: ring.y,
            unit: ring.unit,
            score: skew,
            shape: ring.shape,
          }
        : {
            ...fine(dark, gray, coarse),
            ...(ring ? { shape: ring.shape } : {}),
          };
    if (found.some((o) => Math.hypot(o.x - b.x, o.y - b.y) < b.unit * 3)) {
      continue;
    }
    found.push(b);
  }
  return found.sort((a, b) => b.score - a.score);
};

export type Located = { gray: Gray; factor: number; bullseyes: Bullseye[] };

export const locateBullseyes = (
  raster: Raster,
  { maxCandidates = 24 }: { maxCandidates?: number } = {},
): Located => {
  const full = toGray(raster);
  const factor = Math.max(
    1,
    Math.ceil(Math.max(raster.width, raster.height) / MAX_WORK_SIDE),
  );
  const passes = factor > 1 ? [factor, 1] : [1];
  for (const f of passes) {
    const work = boxDownscale(full, f);
    const found = findAt(work, maxCandidates).map((b) => ({
      x: (b.x + 0.5) * f - 0.5,
      y: (b.y + 0.5) * f - 0.5,
      unit: b.unit * f,
      score: b.score,
      ...(b.shape ? { shape: b.shape.map((v) => v * f) as Shape } : {}),
    }));
    if (found.length > 0) return { gray: full, factor: f, bullseyes: found };
  }
  return { gray: full, factor: 1, bullseyes: [] };
};

export const estimateLatticeAngle = (gray: Gray, b: Bullseye): number => {
  const { data, width, height } = gray;
  const outer = b.unit * 17;
  const inner = b.unit * 7;
  const x0 = Math.max(1, Math.floor(b.x - outer));
  const x1 = Math.min(width - 2, Math.ceil(b.x + outer));
  const y0 = Math.max(1, Math.floor(b.y - outer));
  const y1 = Math.min(height - 2, Math.ceil(b.y + outer));
  let re = 0;
  let im = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const r = Math.hypot(x - b.x, y - b.y);
      if (r < inner || r > outer) continue;
      const i = y * width + x;
      const gx =
        data[i - width + 1]! +
        2 * data[i + 1]! +
        data[i + width + 1]! -
        data[i - width - 1]! -
        2 * data[i - 1]! -
        data[i + width - 1]!;
      const gy =
        data[i + width - 1]! +
        2 * data[i + width]! +
        data[i + width + 1]! -
        data[i - width - 1]! -
        2 * data[i - width]! -
        data[i - width + 1]!;
      const weight = Math.hypot(gx, gy);
      const theta = Math.atan2(gy, gx);
      re += weight * Math.cos(6 * theta);
      im += weight * Math.sin(6 * theta);
    }
  }
  return Math.atan2(im, re) / 6;
};

const wrap = (angle: number) => {
  const turn = 2 * Math.PI;
  const a = ((angle % turn) + turn) % turn;
  return a > Math.PI ? a - turn : a;
};

export const rotationCandidates = (gray: Gray, b: Bullseye): number[] => {
  const base = estimateLatticeAngle(gray, b) - LATTICE_PHASE;
  return Array.from({ length: 6 }, (_, k) =>
    wrap(base + k * SIXTY_DEGREES),
  ).sort((a, c) => Math.abs(a) - Math.abs(c));
};

const bilinear = (gray: Gray, x: number, y: number) => {
  const { data, width, height } = gray;
  const cx = Math.min(width - 1, Math.max(0, x));
  const cy = Math.min(height - 1, Math.max(0, y));
  const x0 = Math.floor(cx);
  const y0 = Math.floor(cy);
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const fx = cx - x0;
  const fy = cy - y0;
  const top = data[y0 * width + x0]! * (1 - fx) + data[y0 * width + x1]! * fx;
  const bottom =
    data[y1 * width + x0]! * (1 - fx) + data[y1 * width + x1]! * fx;
  return top * (1 - fy) + bottom * fy;
};

type Alignment = {
  scale: number;
  angle: number;
  sx: number;
  sy: number;
  stretch: number;
  shear: number;
  px: number;
  py: number;
};

const PATCH_UNIT = 8;
const PATCH_RADIUS_UNITS = 27;

const isSkewed = ({ shape }: Bullseye) => {
  if (!shape) return false;
  const [a, b, , d] = shape;
  const mid = (a + d) / 2;
  const spread = Math.hypot((a - d) / 2, b);
  return (mid + spread) / (mid - spread) >= MIN_ELONGATION;
};

const viewsOf = (b: Bullseye): Bullseye[] => {
  const round = { x: b.x, y: b.y, unit: b.unit, score: b.score };
  return isSkewed(b) ? [b, round] : [round];
};

export const rectify = (gray: Gray, b: Bullseye) => {
  const shape = b.shape ?? [b.unit, 0, 0, b.unit];
  const side = 2 * PATCH_RADIUS_UNITS * PATCH_UNIT;
  const data = new Uint8Array(side * side);
  const center = side / 2;
  for (let y = 0; y < side; y++) {
    const v = (y - center) / PATCH_UNIT;
    for (let x = 0; x < side; x++) {
      const u = (x - center) / PATCH_UNIT;
      data[y * side + x] = bilinear(
        gray,
        b.x + shape[0] * u + shape[1] * v,
        b.y + shape[2] * u + shape[3] * v,
      );
    }
  }
  return {
    gray: { data, width: side, height: side },
    bullseye: { x: center, y: center, unit: PATCH_UNIT, score: b.score },
  };
};

type Warp = { dx: Float32Array; dy: Float32Array };

const WARP_NODES = 5;
const WARP_SPAN = 21;
const WARP_STEPS = [-0.5, -0.25, 0.25, 0.5];

const emptyWarp = (): Warp => ({
  dx: new Float32Array(WARP_NODES * WARP_NODES),
  dy: new Float32Array(WARP_NODES * WARP_NODES),
});

const warpAt = (field: Float32Array, u: number, v: number) => {
  const last = WARP_NODES - 1;
  const gx = Math.min(
    last,
    Math.max(0, ((u + WARP_SPAN) / (2 * WARP_SPAN)) * last),
  );
  const gy = Math.min(
    last,
    Math.max(0, ((v + WARP_SPAN) / (2 * WARP_SPAN)) * last),
  );
  const x0 = Math.min(last - 1, Math.floor(gx));
  const y0 = Math.min(last - 1, Math.floor(gy));
  const fx = gx - x0;
  const fy = gy - y0;
  const at = (x: number, y: number) => field[y * WARP_NODES + x]!;
  return (
    (at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx) * (1 - fy) +
    (at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx) * fy
  );
};

type Module = { col: number; row: number; dx: number; dy: number };

const GRID = { cols: 30, rows: 33 };
const CANVAS = { width: 330, height: 300 };
const BULLSEYE_RADIUS_UNITS = 5.9;
const TAP = 0.3;

const MODULES: Module[] = Array.from({ length: GRID.rows }, (_, row) =>
  Array.from({ length: GRID.cols }, (_, col) => {
    const x = (col + 0.5 + 0.5 * (row & 1)) * (SPAN_WIDTH / GRID.cols);
    const y = (row + 0.5) * (SPAN_HEIGHT / GRID.rows);
    return { col, row, dx: x - SPAN_UNITS.left, dy: y - SPAN_UNITS.top };
  }),
)
  .flat()
  .filter((m) => Math.hypot(m.dx, m.dy) > BULLSEYE_RADIUS_UNITS);

export const sampleModules = (
  gray: Gray,
  b: Bullseye,
  rotation: number,
  a: Alignment,
  warp?: Warp,
): Float32Array => {
  const out = new Float32Array(MODULES.length);
  const cos = Math.cos(rotation + a.angle);
  const sin = Math.sin(rotation + a.angle);
  const tapX = [0, TAP, -TAP, 0, 0];
  const tapY = [0, 0, 0, TAP, -TAP];
  MODULES.forEach((m, i) => {
    const wx = warp ? warpAt(warp.dx, m.dx, m.dy) : 0;
    const wy = warp ? warpAt(warp.dy, m.dx, m.dy) : 0;
    let sum = 0;
    for (let t = 0; t < 5; t++) {
      const v0 = ((m.dy + wy + a.sy + tapY[t]!) * a.scale) / (1 + a.stretch);
      const u0 =
        (m.dx + wx + a.sx + tapX[t]!) * a.scale * (1 + a.stretch) +
        a.shear * v0;
      const w = 1 + a.px * u0 + a.py * v0;
      const dx = u0 / w;
      const dy = v0 / w;
      sum += bilinear(
        gray,
        b.x + (dx * cos - dy * sin) * b.unit,
        b.y + (dx * sin + dy * cos) * b.unit,
      );
    }
    out[i] = sum / 5;
  });
  return out;
};

export const variance = (values: Float32Array) => {
  let sum = 0;
  let squares = 0;
  for (const v of values) {
    sum += v;
    squares += v * v;
  }
  const m = sum / values.length;
  return squares / values.length - m * m;
};

const NEIGHBOR_RADIUS = 3.2;

let neighbors: number[][] | null = null;

const moduleNeighbors = () =>
  (neighbors ??= MODULES.map((m) =>
    MODULES.flatMap((o, j) =>
      Math.hypot(o.dx - m.dx, o.dy - m.dy) <= NEIGHBOR_RADIUS ? [j] : [],
    ),
  ));

const localThresholds = (values: Float32Array) => {
  const around = moduleNeighbors();
  return Float32Array.from(values, (_, i) => {
    const near = around[i]!;
    let low = Infinity;
    let high = -Infinity;
    for (const j of near) {
      low = Math.min(low, values[j]!);
      high = Math.max(high, values[j]!);
    }
    return (low + high) / 2;
  });
};

const otsu = (values: Float32Array) => {
  const histogram = new Array<number>(256).fill(0);
  for (const v of values)
    histogram[Math.min(255, Math.max(0, Math.round(v)))]!++;
  const total = values.length;
  let sumAll = 0;
  for (let i = 0; i < 256; i++) sumAll += i * histogram[i]!;
  let weightBack = 0;
  let sumBack = 0;
  let best = 0;
  let threshold = 128;
  for (let t = 0; t < 256; t++) {
    weightBack += histogram[t]!;
    if (weightBack === 0) continue;
    const weightFront = total - weightBack;
    if (weightFront === 0) break;
    sumBack += t * histogram[t]!;
    const diff = sumBack / weightBack - (sumAll - sumBack) / weightFront;
    const between = weightBack * weightFront * diff * diff;
    if (between > best) {
      best = between;
      threshold = t;
    }
  }
  return threshold;
};

const PARAMETERS = [
  'scale',
  'sx',
  'sy',
  'angle',
  'stretch',
  'shear',
  'px',
  'py',
] as const;

const ROUNDS = [
  {
    scale: 0.14,
    sx: 0.5,
    sy: 0.5,
    angle: (3 * Math.PI) / 180,
    stretch: 0.05,
    shear: 0.06,
    px: 0.005,
    py: 0.005,
    count: 15,
  },
  {
    scale: 0.03,
    sx: 0.12,
    sy: 0.12,
    angle: (0.8 * Math.PI) / 180,
    stretch: 0.015,
    shear: 0.015,
    px: 0.0015,
    py: 0.0015,
    count: 9,
  },
  {
    scale: 0.008,
    sx: 0.04,
    sy: 0.04,
    angle: (0.25 * Math.PI) / 180,
    stretch: 0.004,
    shear: 0.004,
    px: 0.0004,
    py: 0.0004,
    count: 7,
  },
];

export const alignModules = (
  gray: Gray,
  b: Bullseye,
  rotation: number,
  startScale = 1.03,
) => {
  let alignment: Alignment = {
    scale: startScale,
    angle: 0,
    sx: 0,
    sy: 0,
    stretch: 0,
    shear: 0,
    px: 0,
    py: 0,
  };
  let score = variance(sampleModules(gray, b, rotation, alignment));
  for (const round of ROUNDS) {
    for (const key of PARAMETERS) {
      const center = alignment[key];
      for (let i = 0; i < round.count; i++) {
        const value =
          center - round[key] + (2 * round[key] * i) / (round.count - 1);
        const trial = { ...alignment, [key]: value };
        const trialScore = variance(sampleModules(gray, b, rotation, trial));
        if (trialScore > score) {
          score = trialScore;
          alignment = trial;
        }
      }
    }
  }
  return { alignment, score };
};

const SCALE_STARTS = [1.03, 0.92, 1.15];

const bestAlignment = (gray: Gray, b: Bullseye, rotation: number) =>
  SCALE_STARTS.map((start) => alignModules(gray, b, rotation, start)).reduce(
    (best, next) => (next.score > best.score ? next : best),
  ).alignment;

const renderModules = (
  values: Float32Array,
  isLight: (value: number, index: number) => boolean,
): Raster => {
  const { width, height } = CANVAS;
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  const paint = (x0: number, y0: number, x1: number, y1: number) => {
    for (let y = Math.max(0, y0); y <= Math.min(height - 1, y1); y++) {
      for (let x = Math.max(0, x0); x <= Math.min(width - 1, x1); x++) {
        data.fill(0, (y * width + x) * 4, (y * width + x) * 4 + 3);
      }
    }
  };
  MODULES.forEach((m, i) => {
    if (isLight(values[i]!, i)) return;
    const x = Math.floor(
      (m.col * width + width / 2 + (m.row & 1) * (width / 2)) / GRID.cols,
    );
    const y = Math.floor((m.row * height + height / 2) / GRID.rows);
    paint(x - 3, y - 3, x + 3, y + 3);
  });
  return { data, width, height };
};

const fitWarp = (
  gray: Gray,
  b: Bullseye,
  rotation: number,
  alignment: Alignment,
): Warp => {
  const warp = emptyWarp();
  let score = variance(sampleModules(gray, b, rotation, alignment, warp));
  for (let pass = 0; pass < 2; pass++) {
    for (const field of [warp.dx, warp.dy]) {
      for (let node = 0; node < field.length; node++) {
        const start = field[node]!;
        let best = start;
        for (const step of WARP_STEPS) {
          field[node] = start + step;
          const trial = variance(
            sampleModules(gray, b, rotation, alignment, warp),
          );
          if (trial > score) {
            score = trial;
            best = start + step;
          }
        }
        field[node] = best;
      }
    }
  }
  return warp;
};

const SHARPEN = 0.9;
const NEAREST_RADIUS = 1.25;

let nearest: number[][] | null = null;

const sharpened = (values: Float32Array) => {
  nearest ??= MODULES.map((m, i) =>
    MODULES.flatMap((o, j) =>
      j !== i && Math.hypot(o.dx - m.dx, o.dy - m.dy) <= NEAREST_RADIUS
        ? [j]
        : [],
    ),
  );
  const around = nearest;
  return Float32Array.from(values, (v, i) => {
    const near = around[i]!;
    if (near.length === 0) return v;
    let sum = 0;
    for (const j of near) sum += values[j]!;
    return v + SHARPEN * (v - sum / near.length);
  });
};

const paintOtsu = (values: Float32Array) => {
  const threshold = otsu(values);
  return renderModules(values, (value) => value > threshold);
};

const paintLocal = (values: Float32Array) => {
  const thresholds = localThresholds(values);
  return renderModules(values, (value, i) => value > thresholds[i]!);
};

const paintings = (values: Float32Array) => {
  const sharp = sharpened(values);
  return [paintOtsu(values), paintLocal(values), paintLocal(sharp)];
};

export const render = (
  gray: Gray,
  b: Bullseye,
  rotation: number,
  alignment: Alignment,
): Raster => paintOtsu(sampleModules(gray, b, rotation, alignment));

export const straighten = (gray: Gray, b: Bullseye, rotation: number) =>
  render(gray, b, rotation, bestAlignment(gray, b, rotation));

export const straightenAll = (located: Located): Straightened[] =>
  located.bullseyes.flatMap((bullseye) => {
    const view = rectify(located.gray, viewsOf(bullseye)[0]!);
    return rotationCandidates(view.gray, view.bullseye).map((rotation) => ({
      raster: straighten(view.gray, view.bullseye, rotation),
      bullseye,
      rotation,
    }));
  });

const MAXICODE_BUDGET_MS = 2000;

export const readMaxiCode = async (
  raster: Raster,
  read: RasterReader,
  { budgetMs = MAXICODE_BUDGET_MS }: { budgetMs?: number } = {},
): Promise<MaxiCodeRead | null> => {
  const deadline = performance.now() + budgetMs;
  const located = locateBullseyes(raster);
  let candidates = 0;
  for (const bullseye of located.bullseyes) {
    for (const shaped of viewsOf(bullseye)) {
      if (performance.now() > deadline) return null;
      const view = rectify(located.gray, shaped);
      const fits = rotationCandidates(view.gray, view.bullseye).map(
        (rotation) => ({
          rotation,
          alignment: bestAlignment(view.gray, view.bullseye, rotation),
        }),
      );
      const attempt = async (
        rotation: number,
        values: Float32Array,
      ): Promise<MaxiCodeRead | null> => {
        for (const raster of paintings(values)) {
          candidates++;
          const symbols = await read(raster);
          if (symbols.length > 0) {
            return { symbols, bullseye, rotation, candidates };
          }
        }
        return null;
      };
      for (const { rotation, alignment } of fits) {
        const hit = await attempt(
          rotation,
          sampleModules(view.gray, view.bullseye, rotation, alignment),
        );
        if (hit) return hit;
      }
      for (const { rotation, alignment } of fits) {
        if (performance.now() > deadline) return null;
        const warp = fitWarp(view.gray, view.bullseye, rotation, alignment);
        const hit = await attempt(
          rotation,
          sampleModules(view.gray, view.bullseye, rotation, alignment, warp),
        );
        if (hit) return hit;
      }
    }
  }
  return null;
};
