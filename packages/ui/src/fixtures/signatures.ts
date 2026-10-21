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
