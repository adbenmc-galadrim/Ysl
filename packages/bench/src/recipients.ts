import { FIRST_CLIENT } from './first-client';
import { seeded } from '@repo/corpus/random';
import { type Timing, timing } from '#metrics';
import {
  indexRecipients,
  matchRecipient,
  type RecipientEntry,
  silentMatch,
  type RecipientRead,
} from '@repo/contract/recipient';

const FIRST_NAMES = [
  'Léa',
  'Louis',
  'Lise',
  'Hugo',
  'Camille',
  'Nora',
  'Inès',
  'Isabelle',
  'Eulalie',
  'Jade',
  'Raphaël',
  'Chloé',
  'Lucas',
  'Manon',
  'Théo',
  'Emma',
  'Nathan',
  'Zoé',
  'Jules',
  'Alice',
  'Arthur',
  'Louise',
  'Gabriel',
  'Rose',
  'Adam',
  'Anna',
  'Paul',
  'Mila',
  'Léo',
  'Julia',
  'Sacha',
  'Lina',
  'Noé',
  'Clara',
  'Tom',
  'Sarah',
  'Victor',
  'Elsa',
  'Axelle',
  'Ivan',
  'Irène',
  'Mathis',
  'Agathe',
  'Yanis',
  'Margaux',
  'Samuel',
  'Juliette',
  'Martin',
];

const LAST_NAMES = [
  'Fontaine',
  'Fontan',
  'Dupont',
  'Dupond',
  'Morel',
  'Haddad',
  'Lefèvre',
  'Lefebvre',
  'Moreau',
  'Martin',
  'Bernard',
  'Durand',
  'Petit',
  'Leroy',
  'Garnier',
  'Faure',
  'Rousseau',
  'Blanc',
  'Guerin',
  'Muller',
  'Henry',
  'Roussel',
  'Nicolas',
  'Perrin',
  'Morin',
  'Mathieu',
  'Clément',
  'Gauthier',
  'Dumont',
  'Lopez',
  'Fournier',
  'Girard',
  'Bonnet',
  'Mercier',
  'Lambert',
  'Nguyen',
  'Benali',
  'de La Rochère',
  'Le Gall',
  'Van Damme',
  'Lelièvre',
  'Chevalier',
  'François',
  'Legrand',
  'Garcia',
  'Roux',
  'Vincent',
  'Fabre',
  'Brunet',
  'Schmitt',
  'Colin',
  'Barbier',
  'Arnaud',
  'Giraud',
];

/**
 * A fictitious directory of `size` people, every first name crossed with
 * every last name in a seeded order: homonyms come as in a real company
 * (several Fontaine, a Fontan, a Dupond next to a Dupont).
 */
export function syntheticDirectory(size: number, seed = 46): RecipientEntry[] {
  const random = seeded(seed);
  const pairs = FIRST_NAMES.flatMap((firstName) =>
    LAST_NAMES.map((lastName) => ({ firstName, lastName })),
  );
  for (let i = pairs.length - 1; i > 0; i -= 1) {
    const j = random.int(0, i);
    [pairs[i], pairs[j]] = [pairs[j]!, pairs[i]!];
  }
  const people: RecipientEntry[] = [];
  for (let i = 0; i < size; i += 1) {
    const pair = pairs[i % pairs.length]!;
    people.push({ id: `p${i}`, kind: 'person', ...pair });
  }
  return people;
}

const upper = (text: string) => text.toUpperCase();
const plain = (text: string) =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase();

const swapOne = (word: string, from: string, to: string) => {
  const at = word.indexOf(from);
  return at < 0 ? null : word.slice(0, at) + to + word.slice(at + from.length);
};

/** How a label or the OCR spoils a printed name (v1 cases, §4.8). */
export type Noise = {
  id: string;
  title: string;
  /** The name as read; null when this spoiling does not apply to that name. */
  apply: (person: RecipientEntry) => string | null;
};

export const NOISES: readonly Noise[] = [
  {
    id: 'exact',
    title: 'Nom complet',
    apply: (p) => upper(`${p.firstName} ${p.lastName}`),
  },
  {
    id: 'reversed',
    title: 'Nom puis prénom, sans accent',
    apply: (p) => plain(`${p.lastName} ${p.firstName}`),
  },
  {
    id: 'initial',
    title: 'Initiale du prénom',
    apply: (p) => plain(`${p.firstName[0]}. ${p.lastName}`),
  },
  {
    id: 'cut',
    title: 'Nom coupé (reflet, pli)',
    apply: (p) => {
      const last = plain(p.lastName);
      return last.length < 6
        ? null
        : `${plain(p.firstName)} ${last.slice(0, -1)}`;
    },
  },
  {
    id: 'digit',
    title: 'Chiffre pour une lettre',
    apply: (p) => {
      const name = plain(`${p.firstName} ${p.lastName}`);
      return (
        swapOne(name, 'O', '0') ??
        swapOne(name, 'I', '1') ??
        swapOne(name, 'S', '5') ??
        swapOne(name, 'B', '8')
      );
    },
  },
  {
    id: 'bar',
    title: '« | » pour « I »',
    apply: (p) =>
      p.firstName.startsWith('I')
        ? `|${plain(p.firstName).slice(1)} ${plain(p.lastName)}`
        : null,
  },
  {
    id: 'split',
    title: 'Mot coupé en deux',
    apply: (p) => {
      const last = plain(p.lastName);
      return last.length < 6
        ? null
        : `${plain(p.firstName)} ${last.slice(0, 3)} ${last.slice(3)}`;
    },
  },
  {
    id: 'glued',
    title: 'Espace perdu',
    apply: (p) => plain(`${p.firstName}${p.lastName}`).replace(/\s/g, ''),
  },
  {
    id: 'typo',
    title: 'Une lettre fausse',
    apply: (p) => {
      const last = plain(p.lastName);
      if (last.length < 5) return null;
      const i = Math.floor(last.length / 2);
      const wrong = last[i] === 'E' ? 'A' : 'E';
      return `${plain(p.firstName)} ${last.slice(0, i)}${wrong}${last.slice(i + 1)}`;
    },
  },
  {
    id: 'company',
    title: 'Débris de la société',
    apply: (p) => `SA1NT LAURENT ${plain(`${p.firstName} ${p.lastName}`)}`,
  },
  {
    id: 'last-only',
    title: 'Nom seul',
    apply: (p) => plain(p.lastName),
  },
];

export type NoiseOutcome = {
  noise: string;
  size: number;
  cases: number;
  /** The person is the selection the screen makes. */
  top1: number;
  /** The person is among the three suggestions (O3). */
  top3: number;
  /** Another person selected: what the agent must catch. */
  wrongBest: number;
  /** Another person settled without the agent (a code name, exact): must stay 0. */
  wrongSilent: number;
};

export type SizeTiming = { size: number } & Timing;

export type RecipientBench = {
  outcomes: NoiseOutcome[];
  timings: SizeTiming[];
  /** On an empty directory, the share of names kept for a new card (D15). */
  emptyReadName: number;
};

/**
 * Each noise on `perSize` people of directories of each size: are they
 * proposed, selected, settled in silence by mistake, and how long one
 * match takes (the Worker's share of §4.2, step 9).
 */
export function benchRecipients(
  sizes: readonly number[],
  perSize: number,
  seed = 46,
): RecipientBench {
  const outcomes: NoiseOutcome[] = [];
  const timings: SizeTiming[] = [];
  for (const size of sizes) {
    const people = syntheticDirectory(size, seed);
    const index = indexRecipients(people, FIRST_CLIENT.anchors);
    const random = seeded(seed + size);
    const picks = Array.from({ length: Math.min(perSize, size) }, () =>
      random.pick(people),
    );
    const times: number[] = [];
    for (const noise of NOISES) {
      const outcome: NoiseOutcome = {
        noise: noise.id,
        size,
        cases: 0,
        top1: 0,
        top3: 0,
        wrongBest: 0,
        wrongSilent: 0,
      };
      for (const person of picks) {
        const text = noise.apply(person);
        if (text === null) continue;
        const reads: RecipientRead[] = [{ text, source: 'code' }];
        const started = performance.now();
        const result = matchRecipient(index, reads);
        times.push(performance.now() - started);
        const same = (entry: RecipientEntry) =>
          entry.firstName === person.firstName &&
          entry.lastName === person.lastName;
        outcome.cases += 1;
        if (result.best && same(result.best.entry)) outcome.top1 += 1;
        if (result.suggestions.some((s) => same(s.entry))) outcome.top3 += 1;
        if (result.best && !same(result.best.entry)) outcome.wrongBest += 1;
        const silent = silentMatch(result);
        if (silent && !same(silent.entry)) {
          outcome.wrongSilent += 1;
        }
      }
      outcomes.push(outcome);
    }
    timings.push({ size, ...timing(times) });
  }
  const empty = indexRecipients([], FIRST_CLIENT.anchors);
  const names = syntheticDirectory(perSize, seed);
  const kept = names.filter(
    (person) =>
      matchRecipient(empty, [
        { text: NOISES[0]!.apply(person)!, source: 'ocr' },
      ]).readName !== null,
  ).length;
  return {
    outcomes,
    timings,
    emptyReadName: names.length ? kept / names.length : 0,
  };
}

const pct = (part: number, whole: number) =>
  whole === 0
    ? '—'
    : `${((part / whole) * 100).toFixed(1).replace('.', ',')} %`;

const ms = (value: number | null) =>
  value === null ? '—' : `${value.toFixed(2).replace('.', ',')} ms`;

export function recipientsMarkdown(bench: RecipientBench): string {
  const sizes = [...new Set(bench.outcomes.map((o) => o.size))];
  const lines = [
    '# Banc du rapprochement destinataire',
    '',
    `Annuaire vide : ${pct(bench.emptyReadName, 1)} des noms lus gardés pour une nouvelle fiche.`,
    '',
  ];
  for (const size of sizes) {
    const rows = bench.outcomes.filter((o) => o.size === size);
    const total = rows.reduce(
      (acc, o) => ({
        cases: acc.cases + o.cases,
        top3: acc.top3 + o.top3,
        top1: acc.top1 + o.top1,
        wrongBest: acc.wrongBest + o.wrongBest,
        wrongSilent: acc.wrongSilent + o.wrongSilent,
      }),
      { cases: 0, top3: 0, top1: 0, wrongBest: 0, wrongSilent: 0 },
    );
    lines.push(
      `## Annuaire de ${size} personnes`,
      '',
      '| Lecture | Cas | Dans les 3 suggestions (O3) | Sélectionné juste | Autre sélectionné | Autre réglé en silence |',
      '| --- | ---: | ---: | ---: | ---: | ---: |',
      ...rows.map((o) => {
        const title = NOISES.find((n) => n.id === o.noise)!.title.replace(
          /\|/g,
          '\\|',
        );
        return `| ${title} | ${o.cases} | ${pct(o.top3, o.cases)} | ${pct(o.top1, o.cases)} | ${pct(o.wrongBest, o.cases)} | ${o.wrongSilent} |`;
      }),
      `| **Toutes** | ${total.cases} | **${pct(total.top3, total.cases)}** | ${pct(total.top1, total.cases)} | ${pct(total.wrongBest, total.cases)} | ${total.wrongSilent} |`,
      '',
    );
  }
  lines.push(
    '## Temps par rapprochement (Node, Mac)',
    '',
    '| Annuaire | p50 | p95 |',
    '| ---: | ---: | ---: |',
    ...bench.timings.map((t) => `| ${t.size} | ${ms(t.p50)} | ${ms(t.p95)} |`),
    '',
  );
  return lines.join('\n');
}
