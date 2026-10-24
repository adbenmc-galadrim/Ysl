import { decodeSource, type Symbol } from '@repo/barcode';
import { extractFields } from '@repo/contract/extract';
import type { Carrier, Source } from '@repo/corpus/schema';
import { type BenchLabel, isPdfSpecimen } from '#corpus';
import type { BenchImage } from '#image';
import { measure } from '#measure';
import type { LabelResult } from '#metrics';

export const POLICIES = ['first', 'thorough'] as const;

export type Policy = (typeof POLICIES)[number];

export type Contents2d = Record<
  string,
  {
    source: Source;
    carrier: Carrier;
    symbols: { format: string; text: string }[];
  }
>;

const TWO_D = new Set(['DataMatrix', 'Aztec', 'PDF417', 'QRCode', 'MaxiCode']);

const EMPTY_SYMBOLS: Symbol[] = [];

export const runLabel = async (
  label: BenchLabel,
  image: BenchImage | null,
  policy: Policy,
  contents: Contents2d,
): Promise<LabelResult> => {
  let symbols = EMPTY_SYMBOLS;
  let steps: LabelResult['steps'] = [];
  let decodeMs = 0;
  let error: string | undefined;
  if (image === null) error = 'image illisible';
  else {
    try {
      const decoded = await decodeSource(image.source, {
        thorough: policy === 'thorough',
      });
      symbols = decoded.symbols;
      steps = decoded.steps.map(({ name, ms, symbols: n }) => ({
        name,
        ms,
        symbols: n,
      }));
      decodeMs = decoded.totalMs;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }
  const started = performance.now();
  const extraction = extractFields({ symbols });
  const extractMs = performance.now() - started;

  const entry = (contents[label.id] ??= {
    source: label.source,
    carrier: label.carrier,
    symbols: [],
  });
  for (const s of symbols) {
    if (!TWO_D.has(s.format)) continue;
    if (
      !entry.symbols.some((x) => x.format === s.format && x.text === s.text)
    ) {
      entry.symbols.push({ format: s.format, text: s.text });
    }
  }

  return {
    id: label.id,
    source: label.source,
    carrier: label.carrier,
    policy,
    reviewed: label.reviewed,
    pdfSpecimen: isPdfSpecimen(label),
    trackingKnown: label.tracking !== null,
    difficulties: label.difficulties,
    formats: [...new Set(symbols.map((s) => s.format))],
    steps,
    decodeMs,
    extractMs,
    fields: measure(label, extraction),
    ...(error === undefined ? {} : { error }),
  };
};
