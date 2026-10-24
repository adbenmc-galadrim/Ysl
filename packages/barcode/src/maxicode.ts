import type { RasterReader } from '#tiles';
import type { Raster, Symbol } from '#zxing';

export type Bullseye = {
  x: number;
  y: number;
  unit: number;
  score: number;
};

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
const RING_PATTERN = [1.6, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1];
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
    if (coarse.score < SCORE_THRESHOLD) continue;
    const b = fine(dark, gray, coarse);
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

type Alignment = { scale: number; angle: number; sx: number; sy: number };

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
): Float32Array => {
  const out = new Float32Array(MODULES.length);
  const cos = Math.cos(rotation + a.angle);
  const sin = Math.sin(rotation + a.angle);
  const tapX = [0, TAP, -TAP, 0, 0];
  const tapY = [0, 0, 0, TAP, -TAP];
  MODULES.forEach((m, i) => {
    let sum = 0;
    for (let t = 0; t < 5; t++) {
      const dx = (m.dx + a.sx + tapX[t]!) * a.scale;
      const dy = (m.dy + a.sy + tapY[t]!) * a.scale;
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

const PARAMETERS = ['scale', 'sx', 'sy', 'angle'] as const;

const ROUNDS = [
  { scale: 0.14, sx: 0.5, sy: 0.5, angle: (3 * Math.PI) / 180, count: 15 },
  { scale: 0.03, sx: 0.12, sy: 0.12, angle: (0.8 * Math.PI) / 180, count: 9 },
  { scale: 0.008, sx: 0.04, sy: 0.04, angle: (0.25 * Math.PI) / 180, count: 7 },
];

export const alignModules = (gray: Gray, b: Bullseye, rotation: number) => {
  let alignment: Alignment = { scale: 1.03, angle: 0, sx: 0, sy: 0 };
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

export const render = (
  gray: Gray,
  b: Bullseye,
  rotation: number,
  alignment: Alignment,
): Raster => {
  const values = sampleModules(gray, b, rotation, alignment);
  const threshold = otsu(values);
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
    if (values[i]! > threshold) return;
    const x = Math.floor(
      (m.col * width + width / 2 + (m.row & 1) * (width / 2)) / GRID.cols,
    );
    const y = Math.floor((m.row * height + height / 2) / GRID.rows);
    paint(x - 3, y - 3, x + 3, y + 3);
  });
  return { data, width, height };
};

export const straighten = (gray: Gray, b: Bullseye, rotation: number) =>
  render(gray, b, rotation, alignModules(gray, b, rotation).alignment);

export const straightenAll = (located: Located): Straightened[] =>
  located.bullseyes.flatMap((bullseye) => {
    return rotationCandidates(located.gray, bullseye).map((rotation) => ({
      raster: straighten(located.gray, bullseye, rotation),
      bullseye,
      rotation,
    }));
  });

export const readMaxiCode = async (
  raster: Raster,
  read: RasterReader,
): Promise<MaxiCodeRead | null> => {
  const located = locateBullseyes(raster);
  let candidates = 0;
  for (const bullseye of located.bullseyes) {
    for (const rotation of rotationCandidates(located.gray, bullseye)) {
      candidates++;
      const symbols = await read(straighten(located.gray, bullseye, rotation));
      if (symbols.length > 0) {
        return { symbols, bullseye, rotation, candidates };
      }
    }
  }
  return null;
};
