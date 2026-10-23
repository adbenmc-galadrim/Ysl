import { cn } from '#lib/tv';

/** Error function, Abramowitz–Stegun 7.1.26: plenty for a gradient. */
function erf(x: number) {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-x * x);
  return x < 0 ? -y : y;
}

/** Share of a segment of half-length `a`, blurred by `sigma`, seen at `d`. */
const blurred = (a: number, d: number, sigma: number) =>
  0.5 * (erf((a - d) / (sigma * Math.SQRT2)) + erf((a + d) / (sigma * Math.SQRT2)));

/**
 * A soft colour bloom behind a section: Penpot's blurred ellipse, drawn as
 * a radial gradient. A CSS blur filter would do the same at runtime, but on
 * a layer this large it costs a full-screen repaint on scroll — and headless
 * Chrome renders it unblurred. The colour comes from the text colour.
 */
export type GlowProps = {
  /** The ellipse as drawn in Penpot, before its blur. */
  x: number;
  y: number;
  w: number;
  h: number;
  alpha: number;
  /** Penpot's layer blur value: a standard deviation, in px. */
  sigma: number;
  className: string;
};

export function Glow({ x, y, w, h, alpha, sigma, className }: GlowProps) {
  const a = w / 2;
  const b = h / 2;
  const reach = 2.5 * sigma;
  const centre = blurred(b, 0, sigma);
  const stops = Array.from({ length: 13 }, (_, i) => {
    const t = i / 12;
    const v = alpha * centre * blurred(a, t * (a + reach), sigma);
    return `color-mix(in srgb, currentColor ${(v * 100).toFixed(2)}%, transparent) ${(t * 100).toFixed(1)}%`;
  });
  return (
    <span
      aria-hidden="true"
      className={cn('pointer-events-none absolute -z-10', className)}
      style={{
        left: x - reach,
        top: y - reach,
        width: w + 2 * reach,
        height: h + 2 * reach,
        background: `radial-gradient(closest-side, ${stops.join(', ')})`,
      }}
    />
  );
}
