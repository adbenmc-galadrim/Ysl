/**
 * Demo signatures, as the strokes a `SignaturePad` records: SVG path data in
 * the pad's own pixels, origin at its bottom-left corner (so y is negative).
 */
export const SIGNATURES = {
  /** Nora Haddad's, as drawn on the signature mockup. */
  nora: [
    'M54,-150C68,-200,80,-220,88,-206C96,-192,78,-152,92,-162C106,-172,110,-210,122,-202C134,-194,118,-162,132,-170C146,-178,146,-200,156,-196C166,-192,158,-174,170,-178C182,-182,186,-202,198,-200C210,-198,202,-180,216,-184C230,-188,238,-202,250,-200C262,-198,260,-190,274,-194',
    'M106,-134C146,-140,206,-142,276,-146',
  ],
} satisfies Record<string, string[]>;

/**
 * A signature as the app keeps it, ink only and cropped, for the stories
 * that show one: an SVG image of the strokes, in place of the PNG.
 */
export function signatureImageUrl(strokes: readonly string[]): string {
  const paths = strokes.map((d) => `<path d="${d}"/>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="44 -230 242 106" fill="none" stroke="black" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
