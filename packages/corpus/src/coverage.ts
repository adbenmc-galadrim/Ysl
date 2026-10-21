import type { Carrier, Label, Source } from '#schema';

export const target = { total: 100, carriers: 6, perCarrier: 10 };

export type Coverage = {
  total: number;
  byCarrier: Partial<Record<Carrier, number>>;
  bySource: Partial<Record<Source, number>>;
  problems: string[];
};

const count = <K extends string>(keys: K[]) =>
  keys.reduce<Partial<Record<K, number>>>(
    (acc, key) => ({ ...acc, [key]: (acc[key] ?? 0) + 1 }),
    {},
  );

export const coverage = (labels: Label[], goal = target): Coverage => {
  const byCarrier = count(labels.map((l) => l.carrier));
  const bySource = count(labels.map((l) => l.source));
  const problems: string[] = [];

  const ids = labels.map((l) => l.id);
  const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (duplicates.length > 0) {
    problems.push(
      `identifiants en double : ${[...new Set(duplicates)].join(', ')}`,
    );
  }
  if (labels.length < goal.total) {
    problems.push(`${labels.length} étiquettes, il en faut ${goal.total}`);
  }
  const covered = Object.entries(byCarrier).filter(
    ([carrier, n]) => carrier !== 'other' && (n ?? 0) >= goal.perCarrier,
  );
  if (covered.length < goal.carriers) {
    problems.push(
      `${covered.length} transporteurs à ${goal.perCarrier} étiquettes ou plus, il en faut ${goal.carriers}`,
    );
  }

  return { total: labels.length, byCarrier, bySource, problems };
};
