export type Git = (args: string[]) => Promise<string>;

export type Problem = {
  kind: 'dirty' | 'file' | 'leak' | 'attribution';
  detail: string;
};

/** What the label says and the user typed: names, numbers, the comment. */
export type Sensitive = { personal: string[]; other: string[] };

export type PushCheck = {
  git: Git;
  base: string;
  branch: string;
  title: string;
  body: string;
  sensitive: Sensitive;
};

const IMAGE = /\.(jpe?g|png|heic|heif|webp|gif|bmp|tiff?|pdf|avif)$/i;

/** The agent's own guard rails and the bench's scoring are not its to change. */
const FORBIDDEN: [RegExp, string][] = [
  [/^tmp\//, 'dossier tmp/'],
  [/(^|\/)annotations\.json$/, 'annotations du corpus'],
  [/(^|\/)pnpm-lock\.yaml$/, 'lockfile'],
  [/^packages\/bench\//, 'banc de mesure'],
  [/^packages\/scan-agent\//, 'outillage de l’agent'],
  [/^\.github\//, 'CI'],
];

const ATTRIBUTION =
  /co-authored-by|generated with|claude\.(ai|com)|anthropic|\bclaude\b|🤖/i;

export const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}@.]+/gu, ' ')
    .trim();

const compact = (text: string) =>
  normalize(text).replace(/[^\p{L}\p{N}]/gu, '');

const words = (text: string) =>
  normalize(text)
    .split(/[\s.]+/)
    .filter(Boolean);

type Needle = {
  value: string;
  mode: 'phrase' | 'word' | 'compact';
  raw: string;
};

/**
 * A personal value leaks whole, word by word, or with its spaces dropped (a
 * tracking printed in groups). Of the other texts (the OCR lines), only what
 * carries numbers is personal enough: an address, a phone, an e-mail. Words
 * such as « EXPÉDITEUR » may go into a parser.
 */
export function needlesOf({ personal, other }: Sensitive): Needle[] {
  const needles: Needle[] = [];
  const add = (value: string, mode: Needle['mode'], raw: string) => {
    if (!needles.some((n) => n.value === value && n.mode === mode)) {
      needles.push({ value, mode, raw });
    }
  };
  for (const raw of personal) {
    const phrase = normalize(raw);
    if (phrase.length >= 4) add(phrase, 'phrase', raw);
    const joined = compact(raw);
    if (joined.length >= 8 && /\d/.test(joined)) add(joined, 'compact', raw);
    for (const word of words(raw)) {
      if (word.replace(/\d/g, '').length >= 3 || /^\d{4,}$/.test(word)) {
        add(word, 'word', raw);
      }
    }
  }
  for (const raw of other) {
    if (!/\d{2,}/.test(raw)) continue;
    const phrase = normalize(raw);
    if (phrase.length >= 6) add(phrase, 'phrase', raw);
    for (const word of words(raw)) {
      if (/\d{4,}/.test(word) || word.includes('@')) add(word, 'word', raw);
    }
  }
  return needles;
}

const found = (needle: Needle, text: string) => {
  if (needle.mode === 'compact') return compact(text).includes(needle.value);
  if (needle.mode === 'word') return words(text).includes(needle.value);
  return ` ${normalize(text)} `.includes(` ${needle.value} `);
};

const mask = (value: string) => `${value.slice(0, 2)}… (${value.length} car.)`;

async function inBase(git: Git, base: string, needle: Needle) {
  const forms = [...new Set([needle.value, needle.raw.trim()])];
  for (const form of forms) {
    try {
      await git(['grep', '-q', '-i', '-F', '-w', '-e', form, base, '--']);
      return true;
    } catch {
      continue;
    }
  }
  return false;
}

/**
 * Run by the hook before `git push`, on what would become public: the diff
 * against the base, the commit messages, the branch, the PR title and body.
 * Any problem blocks the push. A text already public on the base, as a whole
 * word (« Lee » in « sleep » does not count), is not a leak.
 */
export async function checkBeforePush(check: PushCheck): Promise<Problem[]> {
  const { git, base } = check;
  const problems: Problem[] = [];

  if ((await git(['status', '--porcelain'])).trim()) {
    problems.push({ kind: 'dirty', detail: 'modifications non commitées' });
  }

  const numstat = await git([
    'diff',
    '--numstat',
    '--no-renames',
    `${base}...HEAD`,
  ]);
  const paths: string[] = [];
  for (const line of numstat.split('\n').filter(Boolean)) {
    const [added, deleted, path = ''] = line.split('\t');
    paths.push(path);
    if (added === '-' && deleted === '-') {
      problems.push({ kind: 'file', detail: `fichier binaire : ${path}` });
    } else if (IMAGE.test(path)) {
      problems.push({ kind: 'file', detail: `image : ${path}` });
    }
    for (const [pattern, what] of FORBIDDEN) {
      if (pattern.test(path)) {
        problems.push({ kind: 'file', detail: `${what} modifié : ${path}` });
      }
    }
  }

  const diff = await git([
    'diff',
    '-U0',
    '--no-color',
    '--no-renames',
    `${base}...HEAD`,
  ]);
  const added = new Map<string, string[]>();
  let file = '';
  for (const line of diff.split('\n')) {
    if (line.startsWith('+++ ')) file = line.replace(/^\+\+\+ (b\/)?/, '');
    else if (line.startsWith('+')) {
      added.set(file, [...(added.get(file) ?? []), line.slice(1)]);
    }
  }
  const messages = await git(['log', '--format=%B', `${base}..HEAD`]);

  for (const [where, text] of [
    ['messages de commit', messages],
    ['titre de la PR', check.title],
    ['description de la PR', check.body],
  ] as const) {
    if (ATTRIBUTION.test(text)) {
      problems.push({
        kind: 'attribution',
        detail: `attribution IA dans ${where}`,
      });
    }
  }

  const places: [string, string][] = [
    ...[...added].map(([path, lines]): [string, string] => [
      path,
      lines.join('\n'),
    ]),
    ['chemins', paths.join('\n')],
    ['messages de commit', messages],
    ['branche', check.branch.replaceAll(/[/_-]/g, ' ')],
    ['titre de la PR', check.title],
    ['description de la PR', check.body],
  ];
  for (const needle of needlesOf(check.sensitive)) {
    const where = places
      .filter(([, text]) => found(needle, text))
      .map(([w]) => w);
    if (where.length === 0 || (await inBase(git, base, needle))) continue;
    problems.push({
      kind: 'leak',
      detail: `donnée du rapport ${mask(needle.value)} dans : ${where.join(', ')}`,
    });
  }
  return problems;
}
