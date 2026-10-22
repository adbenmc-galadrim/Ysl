import { seeded, type Random } from '#random';
import type { Difficulty, Label } from '#schema';
import {
  firstNames,
  lastNames,
  senders,
  type Sender,
} from '#synthetic/identities';
import { trackingFor, type Tracking } from '#tracking';

export const syntheticCarriers = [
  'colissimo',
  'chronopost',
  'la-poste',
  'dhl-express',
  'ups',
  'fedex',
  'dpd',
  'gls',
] as const;

export type SyntheticCarrier = (typeof syntheticCarriers)[number];

export type Shot = {
  tilt: number;
  blur: number;
  glare: boolean;
  lowLight: boolean;
  noise: boolean;
  crumpled: boolean;
};

export type Planned = {
  id: string;
  carrier: SyntheticCarrier;
  tracking: Tracking;
  recipient: string;
  sender: Sender;
  pieces: { index: number; total: number };
  weightKg: number;
  shot: Shot;
  seed: number;
};

const shotFor = (r: Random, index: number): Shot => {
  if (index % 3 === 0) {
    return {
      tilt: r.int(-3, 3),
      blur: 0,
      glare: false,
      lowLight: false,
      noise: false,
      crumpled: false,
    };
  }
  return {
    tilt: r.next() < 0.5 ? r.int(-25, 25) : r.int(-6, 6),
    blur: r.next() < 0.35 ? r.pick([1.2, 1.8, 2.5]) : 0,
    glare: r.next() < 0.35,
    lowLight: r.next() < 0.25,
    noise: r.next() < 0.3,
    crumpled: r.next() < 0.3,
  };
};

const difficultiesOf = (
  carrier: SyntheticCarrier,
  shot: Shot,
): Difficulty[] => [
  ...(Math.abs(shot.tilt) > 10 ? (['tilt'] as const) : []),
  ...(shot.blur > 0 ? (['blur'] as const) : []),
  ...(shot.glare ? (['glare'] as const) : []),
  ...(shot.lowLight ? (['low-light'] as const) : []),
  ...(shot.noise ? (['noise'] as const) : []),
  ...(shot.crumpled ? (['crumpled'] as const) : []),
  ...(carrier === 'dpd' ? (['vertical-text'] as const) : []),
  ...(carrier === 'ups' ? (['maxicode'] as const) : []),
];

export const plan = (seed: number, perCarrier: number): Planned[] => {
  const r = seeded(seed);
  return syntheticCarriers.flatMap((carrier) =>
    Array.from({ length: perCarrier }, (_, i): Planned => {
      const total = r.next() < 0.75 ? 1 : r.int(2, 4);
      return {
        id: `synthetic-${carrier}-${String(i + 1).padStart(2, '0')}`,
        carrier,
        tracking: trackingFor[carrier](r),
        recipient: `${r.pick(firstNames)} ${r.pick(lastNames)}`,
        sender: r.pick(senders),
        pieces: { index: r.int(1, total), total },
        weightKg: Math.round((0.1 + r.next() * 12) * 10) / 10,
        shot: shotFor(r, i),
        seed: r.int(1, 2 ** 30),
      };
    }),
  );
};

export const annotate = (p: Planned): Label => ({
  id: p.id,
  source: 'synthetic',
  file: `${p.id}.jpg`,
  carrier: p.carrier,
  tracking: p.tracking.value,
  recipient: p.recipient,
  sender: p.sender.name,
  pieces: p.pieces,
  weightKg: p.weightKg,
  difficulties: difficultiesOf(p.carrier, p.shot),
  reviewed: true,
});
