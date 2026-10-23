import {
  formatRates,
  groupRates,
  rate,
  timing,
  type Outcome,
  type Rate,
} from '#/decode/stats';
import type { MatchRule } from '#/decode/match';

export type Result = Outcome & {
  id: string;
  variant: string;
  trackingKnown: boolean;
  difficulties: string[];
  rule: MatchRule | null;
  symbols: number;
  error?: string;
};

export type VariantInfo = { name: string; description: string };

export type RunMeta = {
  generatedAt: string;
  labels: number;
  bySource: Record<string, number>;
  sampled: boolean;
  variants: VariantInfo[];
};

const UNION = 'toutes-variantes';
const MAXICODE = 'MaxiCode';

const pct = (r: Rate) =>
  r.rate === null ? '—' : `${(r.rate * 100).toFixed(1)} %`;

const cell = (r: Rate) => `${r.read} / ${r.total} (${pct(r)})`;

const ms = (value: number | null) =>
  value === null ? '—' : String(Math.round(value));

const table = (head: string[], rows: string[][], numeric = true) =>
  [
    `| ${head.join(' | ')} |`,
    `| ${head.map((_, i) => (i === 0 || !numeric ? '---' : '---:')).join(' | ')} |`,
    ...rows.map((r) => `| ${r.join(' | ')} |`),
  ].join('\n');

const rank = { read: 2, 'code-sans-tracking': 1, 'aucun-code': 0 } as const;

export const unionResults = (results: Result[]): Result[] => {
  const byId = new Map<string, Result[]>();
  for (const r of results) byId.set(r.id, [...(byId.get(r.id) ?? []), r]);
  return [...byId.values()].map((group) => {
    const best = group.reduce((a, b) =>
      rank[b.status] > rank[a.status] ? b : a,
    );
    return {
      ...best,
      variant: UNION,
      status: best.status,
      seenFormats: [...new Set(group.flatMap((g) => g.seenFormats))],
      readFormats: [...new Set(group.flatMap((g) => g.readFormats))],
      ms: group.reduce((sum, g) => sum + g.ms, 0),
      symbols: Math.max(...group.map((g) => g.symbols)),
    };
  });
};

const known = (results: Result[]) => results.filter((r) => r.trackingKnown);
const isField = (r: Result) => r.source !== 'synthetic';

const groupTable = (
  title: string,
  outcomes: Result[],
  key: (r: Result) => string,
) => {
  const groups = groupRates(outcomes, key);
  const rows = Object.entries(groups)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([k, r]) => [
      k,
      String(r.total),
      String(r.read),
      String(r.codeSansTracking),
      String(r.aucunCode),
      pct(r),
    ]);
  return `${title}\n\n${table(['', 'étiquettes', 'tracking lu', 'code sans tracking', 'aucun code', 'taux'], rows)}`;
};

const formatTable = (title: string, outcomes: Result[]) => {
  const rates = formatRates(outcomes);
  const rows = Object.entries(rates)
    .sort((a, b) => b[1].seen - a[1].seen)
    .map(([f, r]) => [
      f,
      String(r.seen),
      String(r.read),
      r.rate === null ? '—' : `${(r.rate * 100).toFixed(1)} %`,
    ]);
  return `${title}\n\n${table(['format', 'étiquettes où il est lu', 'dont tracking retrouvé dans ce format', 'part'], rows)}`;
};

export const buildMarkdown = (meta: RunMeta, results: Result[]) => {
  const union = unionResults(results);
  const names = meta.variants.map((v) => v.name);
  const out: string[] = [];
  const sources = Object.entries(meta.bySource)
    .map(([k, v]) => `${k} ${v}`)
    .join(', ');
  out.push("# Résultats du banc d'essai des codes-barres (spike S2)");
  out.push(
    `Généré le ${meta.generatedAt} sur ${meta.labels} étiquettes (${sources})${meta.sampled ? ', **échantillon**' : ''}. Lecture : zxing-wasm 3.1.6 en Node (WebAssembly), sans parallélisme. Les temps sont ceux d'un Mac, pas d'un iPhone : ils servent à comparer les variantes entre elles.`,
  );
  out.push(
    "Base du critère : les étiquettes dont le tracking est connu (non `null`), regroupées en **web + réelles** (population visée) et **synthèse** (codes générés propres, témoin). Le corpus n'indique pas si un code est visible sur la photo : la ligne « code lu par au moins une variante » donne une base plus étroite qui exclut les images où aucun code n'a pu être détecté.",
  );
  out.push(
    '## Variantes\n\n' +
      table(
        ['variante', 'description'],
        meta.variants.map((v) => [v.name, v.description]),
      ),
  );

  const rowFor = (name: string, all: Result[]) => {
    const mine = known(all).filter((r) => r.variant === name);
    return [
      name,
      cell(rate(mine.filter(isField))),
      cell(rate(mine.filter((r) => !isField(r)))),
    ];
  };
  const seenAny = new Set(
    union.filter((r) => r.status !== 'aucun-code').map((r) => r.id),
  );
  const narrow = known(union).filter((r) => isField(r) && seenAny.has(r.id));
  out.push(
    '## Taux de tracking lu par variante\n\n' +
      table(
        ['variante', 'web + réelles', 'synthèse (témoin)'],
        [
          ...names.map((n) => rowFor(n, results)),
          rowFor(UNION, [...results, ...union]),
          [
            'toutes variantes, base : code lu par au moins une variante',
            cell(rate(narrow)),
            '—',
          ],
        ],
      ),
  );

  const viewfinder = results.filter((r) => r.variant === 'viseur-cascade');
  const pickers: [string, Result[]][] = [
    ['viseur simulé (cascade)', viewfinder],
    ['toutes variantes (meilleur cas)', union],
  ];
  for (const [label, set] of pickers) {
    for (const [group, test] of [
      ['web + réelles', isField],
      ['synthèse', (r: Result) => !isField(r)],
    ] as const) {
      const subset = known(set).filter(test);
      if (subset.length === 0) continue;
      out.push(
        groupTable(
          `## Par transporteur — ${label}, ${group}`,
          subset,
          (r) => r.carrier,
        ),
      );
    }
  }
  for (const [label, set] of pickers) {
    for (const [group, test] of [
      ['web + réelles', isField],
      ['synthèse', (r: Result) => !isField(r)],
    ] as const) {
      const subset = set.filter(test);
      if (subset.length === 0) continue;
      out.push(formatTable(`## Par format — ${label}, ${group}`, subset));
    }
  }
  out.push(
    groupTable(
      '## Par source — toutes variantes (meilleur cas)',
      known(union),
      (r) => r.source,
    ),
  );

  const maxiLabels = new Set(
    known(union)
      .filter(
        (r) =>
          r.difficulties.includes('maxicode') ||
          r.carrier === 'ups' ||
          r.seenFormats.includes(MAXICODE),
      )
      .map((r) => r.id),
  );
  const maxiRow = (variant: string, test: (r: Result) => boolean) => {
    const mine = results.filter(
      (r) => r.variant === variant && maxiLabels.has(r.id) && test(r),
    );
    const read = mine.filter((r) => r.readFormats.includes(MAXICODE)).length;
    const seen = mine.filter((r) => r.seenFormats.includes(MAXICODE)).length;
    return [variant, String(mine.length), String(seen), String(read)];
  };
  out.push(
    '## MaxiCode avec et sans recadrage\n\n' +
      `Étiquettes concernées : tracking connu et (difficulté « maxicode », transporteur UPS ou MaxiCode lu par une variante), soit ${maxiLabels.size}.\n\n` +
      table(
        [
          'variante',
          'étiquettes',
          'MaxiCode lu',
          'dont tracking retrouvé dans le MaxiCode',
        ],
        [
          ...['maxicode-sans-recadrage', 'maxicode-recadre'].flatMap((v) => [
            [`${v} — web + réelles`, ...maxiRow(v, isField).slice(1)],
            [`${v} — synthèse`, ...maxiRow(v, (r) => !isField(r)).slice(1)],
          ]),
        ],
      ),
  );

  const timeRows = [...names].map((n) => {
    const mine = results.filter((r) => r.variant === n);
    const all = timing(mine.map((r) => r.ms));
    const f = timing(mine.filter(isField).map((r) => r.ms));
    const s = timing(mine.filter((r) => !isField(r)).map((r) => r.ms));
    return [
      n,
      String(all.n),
      ms(all.p50),
      ms(all.p95),
      ms(f.p50),
      ms(f.p95),
      ms(s.p50),
      ms(s.p95),
    ];
  });
  out.push(
    '## Temps de lecture par variante (ms, Mac)\n\n' +
      table(
        [
          'variante',
          'images',
          'p50',
          'p95',
          'p50 web + réelles',
          'p95 web + réelles',
          'p50 synthèse',
          'p95 synthèse',
        ],
        timeRows,
      ),
  );

  const rules = groupRates(
    known(union).filter((r) => r.status === 'read'),
    (r) => r.rule ?? 'aucune',
  );
  out.push(
    '## Règle qui a retrouvé le tracking (meilleur cas)\n\n' +
      table(
        ['règle', 'étiquettes'],
        Object.entries(rules).map(([k, r]) => [k, String(r.total)]),
      ),
  );

  const failed = known(union).filter((r) => isField(r) && r.status !== 'read');
  out.push(
    `## Web + réelles sans tracking lu (meilleur cas) : ${failed.length}\n\n` +
      (failed.length === 0
        ? 'Aucune.'
        : failed
            .map((r) => `- ${r.id} (${r.carrier}) : ${r.status}`)
            .join('\n')),
  );
  const errors = results.filter((r) => r.error);
  if (errors.length > 0) {
    out.push(
      `## Erreurs\n\n${errors.map((r) => `- ${r.id} / ${r.variant} : ${r.error}`).join('\n')}`,
    );
  }
  return `${out.join('\n\n')}\n`;
};

export const summarize = (results: Result[]) => {
  const union = unionResults(results);
  const byVariant = Object.fromEntries(
    [...new Set(results.map((r) => r.variant))].map((v) => {
      const mine = results.filter((r) => r.variant === v);
      return [
        v,
        {
          field: rate(known(mine).filter(isField)),
          synthetic: rate(known(mine).filter((r) => !isField(r))),
          timing: timing(mine.map((r) => r.ms)),
        },
      ];
    }),
  );
  return {
    byVariant,
    union: {
      field: rate(known(union).filter(isField)),
      synthetic: rate(known(union).filter((r) => !isField(r))),
      byCarrier: groupRates(known(union).filter(isField), (r) => r.carrier),
      byFormat: formatRates(union.filter(isField)),
    },
  };
};
