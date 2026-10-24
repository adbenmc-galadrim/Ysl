import { FIELDS, type FieldName } from '#measure';
import {
  allFieldStats,
  formatStats,
  groupBy,
  type LabelResult,
  ms,
  objectives,
  pct,
  type Scope,
  scopes,
  timing,
  totalMs,
} from '#metrics';

export type Meta = {
  generatedAt: string;
  corpus: Record<string, number>;
  policies: string[];
  viewfinder: boolean;
  sampled: boolean;
  unreviewed: number;
};

const FIELD_TITLES: Record<FieldName, string> = {
  tracking: 'Tracking',
  carrier: 'Transporteur',
  recipient: 'Destinataire',
  sender: 'Expéditeur',
  pieces: 'Colis n/N',
  weightKg: 'Poids',
};

const row = (cells: readonly (string | number)[]) => `| ${cells.join(' | ')} |`;

const table = (
  header: readonly string[],
  rows: readonly (readonly (string | number)[])[],
) =>
  [
    row(header),
    row(header.map(() => '---')),
    ...rows.map((cells) => row(cells)),
  ].join('\n');

const count = (part: number, whole: number) =>
  `${part} / ${whole} (${pct(whole === 0 ? null : part / whole)})`;

const fieldsTable = (results: readonly LabelResult[]) => {
  const stats = allFieldStats(results);
  return table(
    [
      'Champ',
      'Annotées',
      'Sûr et juste',
      'Sûr et faux',
      'À vérifier, juste',
      'À vérifier, faux',
      'Vide',
      'Exactitude',
      'Faux sûrs',
      'Préremplissage',
      'Top 3',
    ],
    FIELDS.map((f) => {
      const s = stats[f];
      return [
        FIELD_TITLES[f],
        s.annotated,
        s.sureOk,
        s.sureWrong,
        s.verifyOk,
        s.verifyWrong,
        s.empty,
        pct(s.exact),
        pct(s.falseSure),
        pct(s.prefilled),
        pct(s.top3Rate),
      ];
    }),
  );
};

const objectivesTable = (results: readonly LabelResult[]) =>
  table(
    ['Objectif', 'Mesure', 'Cible', 'Atteint'],
    objectives(results).map((o) => [
      `${o.id} · ${o.title}`,
      o.display,
      o.target,
      o.met === null ? '—' : o.met ? 'oui' : 'non',
    ]),
  );

const trackingRead = (r: LabelResult) => {
  const status = r.fields.find((f) => f.field === 'tracking')?.status;
  return status === 'sure-ok' || status === 'verify-ok';
};

const byCarrierTable = (results: readonly LabelResult[]) => {
  const groups = Object.entries(groupBy(results, (r) => r.carrier)).sort(
    (a, b) => b[1].length - a[1].length,
  );
  return table(
    ['Transporteur', 'Étiquettes', 'Tracking juste', 'Faux sûrs', 'Aucun code'],
    groups.map(([carrier, rs]) => [
      carrier,
      rs.length,
      count(rs.filter(trackingRead).length, rs.length),
      rs.filter((r) =>
        r.fields.some(
          (f) => f.field === 'tracking' && f.status === 'sure-wrong',
        ),
      ).length,
      rs.filter((r) => r.formats.length === 0).length,
    ]),
  );
};

const formatsTable = (results: readonly LabelResult[]) =>
  table(
    ['Format', 'Étiquettes où il est lu', 'Dont il porte le tracking juste'],
    Object.entries(formatStats(results))
      .sort((a, b) => b[1].seen - a[1].seen)
      .map(([format, s]) => [format, s.seen, s.carriedTracking]),
  );

const timingTable = (results: readonly LabelResult[]) => {
  const steps = groupBy(
    results.flatMap((r) => r.steps),
    (s) => s.name,
  );
  return table(
    ['Étape', 'Images', 'p50', 'p95'],
    [
      ...Object.entries(steps).map(([name, ss]) => {
        const t = timing(ss.map((s) => s.ms));
        return [name, t.n, ms(t.p50), ms(t.p95)];
      }),
      (() => {
        const t = timing(results.map((r) => r.extractMs));
        return ['extraction', t.n, ms(t.p50), ms(t.p95)];
      })(),
      (() => {
        const t = timing(results.map(totalMs));
        return ['**total par photo**', t.n, ms(t.p50), ms(t.p95)];
      })(),
    ],
  );
};

const scopeSection = (scope: Scope, policy: string) => {
  const results = scope.results.filter((r) => r.policy === policy);
  if (results.length === 0) return '';
  return [
    `### ${scope.title} — ${results.length} étiquettes`,
    '',
    fieldsTable(results),
    '',
    byCarrierTable(results),
    '',
    formatsTable(results),
    '',
    timingTable(results),
    '',
  ].join('\n');
};

export const buildMarkdown = (meta: Meta, results: readonly LabelResult[]) => {
  const parts = [
    `# Banc d'extraction — ${meta.generatedAt}`,
    '',
    `Corpus : ${Object.entries(meta.corpus)
      .map(([s, n]) => `${n} ${s}`)
      .join(
        ', ',
      )}${meta.sampled ? ' (échantillon)' : ''} ; ${meta.unreviewed} annotations encore à relire (\`reviewed: false\`).`,
    `Images ${meta.viewfinder ? 'ramenées au viseur (3024×4032, JPEG 80)' : 'à leur résolution d’origine'} ; politiques : ${meta.policies.join(', ')}.`,
    '',
  ];
  for (const policy of meta.policies) {
    parts.push(`## Politique \`${policy}\``, '');
    for (const scope of scopes(results)) {
      const inScope = scope.results.filter((r) => r.policy === policy);
      if (scope.name === 'reader' && inScope.length > 0) {
        parts.push(
          '### Objectifs O1 à O6 (base du critère)',
          '',
          objectivesTable(inScope),
          '',
        );
      }
      parts.push(scopeSection(scope, policy));
    }
  }
  return `${parts.join('\n').trimEnd()}\n`;
};

const flag = (r: LabelResult) => (r.reviewed ? '' : ' (annotation à relire)');

export const buildMismatches = (results: readonly LabelResult[]) => {
  const rows = results.flatMap((r) =>
    r.fields
      .filter((f) => f.status === 'sure-wrong' || f.status === 'verify-wrong')
      .map((f) => [
        `${r.id}${flag(r)}`,
        r.policy,
        FIELD_TITLES[f.field],
        f.status,
        f.expected ?? '',
        f.proposed ?? '',
        f.confidence === null ? '' : f.confidence.toFixed(2),
        f.sources.join(' '),
      ]),
  );
  const errors = results.filter((r) => r.error !== undefined);
  return [
    '# Écarts du banc',
    '',
    table(
      [
        'Étiquette',
        'Politique',
        'Champ',
        'Statut',
        'Attendu',
        'Proposé',
        'Confiance',
        'Sources',
      ],
      rows,
    ),
    '',
    ...(errors.length > 0
      ? [
          '## Erreurs',
          '',
          ...errors.map((r) => `- ${r.id} (${r.policy}) : ${r.error}`),
          '',
        ]
      : []),
  ].join('\n');
};
