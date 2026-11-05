import { isDeepStrictEqual } from 'node:util';
import {
  appendFile,
  copyFile,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { SCAN_REPORT_VERSION } from '@repo/contract/scan-report';
import { manifestSchema, type Label } from '@repo/corpus/schema';
import {
  type AgentOutcome,
  type AgentResult,
  agentResultSchema,
  type AgentRun,
  MODEL,
  type ThreadRef,
} from '#agent';
import {
  compareResults,
  type Comparison,
  comparisonTable,
  parseResults,
} from '#compare';
import {
  attachReport,
  BRANCH_PREFIX,
  type Forge,
  freeBranch,
  loadRegistry,
  neutralId,
  openPullRequestOf,
  saveRegistry,
} from '#groups';
import { checkBeforePush, type Problem } from '#guard';
import { acquireLock } from '#lock';
import {
  labelKeys,
  readReport,
  ReportError,
  sha256,
  type PulledReport,
} from '#report';
import { threadTitle } from '#thread';

export type Exec = (
  command: string,
  args: string[],
  options: {
    cwd: string;
    log: string;
    timeoutMs: number;
    /** Runs the agent's code: no network, writes only under these folders. */
    sandbox?: string[];
  },
) => Promise<number>;

export type Deps = {
  git: (cwd: string, args: string[]) => Promise<string>;
  exec: Exec;
  runAgent: (run: AgentRun) => Promise<AgentOutcome>;
  agentEnv: (workDir: string) => NodeJS.ProcessEnv;
  forge: Forge & {
    createDraft: (pr: {
      cwd: string;
      branch: string;
      title: string;
      bodyFile: string;
    }) => Promise<number>;
  };
  log: (line: string) => void;
  now: () => Date;
  lockSleep?: (ms: number) => Promise<unknown>;
};

export type Config = {
  /** The checkout the hook runs from. */
  repo: string;
  /** Where the worktrees go: the T3 project's folder, or next to the checkout. */
  worktrees: string;
  reportId: string;
  reportDir: string;
  /** Generator output: `synthetic/labels.json`, `web/labels.json`. */
  corpus: string;
  /** The real photos, out of the repository: `annotations.json`. */
  privateCorpus: string;
  prompt: string;
  base: string;
  maxTurns: number;
  timeoutMs: number;
  /** False with `--no-pr`: everything but the push, the PR and the corpus. */
  openPr: boolean;
};

export type Outcome =
  | { kind: 'pr'; pr: number; branch: string }
  | { kind: 'ready'; branch: string; worktree: string }
  | { kind: 'attached'; pr: number }
  /** Not a report this hook reads (another version, a broken file): no agent. */
  | { kind: 'ignored'; reason: string }
  | { kind: 'failed'; reason: string; worktree: string | null };

class Failure extends Error {
  constructor(
    message: string,
    readonly details: string[] = [],
  ) {
    super(message);
  }
}

const GATES_TIMEOUT_MS = 40 * 60_000;
const BENCH_TIMEOUT_MS = 20 * 60_000;
const INSTALL_TIMEOUT_MS = 10 * 60_000;

export const fill = (template: string, values: Record<string, string>) =>
  template.replaceAll(/\{\{(\w+)\}\}/g, (whole, name: string) => {
    const value = values[name];
    if (value === undefined) throw new Error(`Gabarit : ${whole} sans valeur.`);
    return value;
  });

async function readManifest(file: string): Promise<Label[]> {
  if (!existsSync(file)) return [];
  return manifestSchema.parse(JSON.parse(await readFile(file, 'utf8')));
}

/** A copy of the private corpus the agent may write to, the report's image in it. */
async function prepareCorpus(
  config: Config,
  report: PulledReport,
  dir: string,
  labelId: string,
): Promise<string> {
  await mkdir(dir, { recursive: true });
  const names = existsSync(config.privateCorpus)
    ? await readdir(config.privateCorpus)
    : [];
  for (const name of names) {
    if (name === 'annotations.json' || name.startsWith('.')) continue;
    await symlink(join(config.privateCorpus, name), join(dir, name));
  }
  const annotations = join(config.privateCorpus, 'annotations.json');
  await writeFile(
    join(dir, 'annotations.json'),
    existsSync(annotations) ? await readFile(annotations, 'utf8') : '[]\n',
  );
  const file = `${labelId}.${report.imageExt}`;
  await copyFile(report.imagePath, join(dir, file));
  return file;
}

/** The agent adds one label, its own, and changes no other. */
async function addedLabel(
  config: Config,
  dir: string,
  labelId: string,
  file: string,
): Promise<Label> {
  let after: Label[];
  try {
    after = await readManifest(join(dir, 'annotations.json'));
  } catch (error) {
    throw new Failure('annotations du corpus de travail invalides', [
      error instanceof Error ? error.message : String(error),
    ]);
  }
  const before = await readManifest(
    join(config.privateCorpus, 'annotations.json'),
  );
  const label = after.find((l) => l.id === labelId);
  const others = after.filter((l) => l.id !== labelId);
  if (!label)
    throw new Failure(`étiquette ${labelId} absente du corpus de travail`);
  if (label.source !== 'real' || label.file !== file) {
    throw new Failure(
      `étiquette ${labelId} : source « real » et fichier ${file} attendus`,
    );
  }
  if (!isDeepStrictEqual(others, before)) {
    throw new Failure('les autres étiquettes du corpus ont été modifiées');
  }
  return label;
}

/**
 * What would let code run at `git push` or send it elsewhere: the hooks, the
 * config as git reads it (includes too), the worktree's `.git` pointer. The
 * agent's sandbox can write to the git folder (it commits): nothing there may
 * change. `branch.*` is left out: `git push -u` and tracking write it.
 */
const commonDir = async (deps: Deps, worktree: string) =>
  (
    await deps.git(worktree, [
      'rev-parse',
      '--path-format=absolute',
      '--git-common-dir',
    ])
  ).trim();

async function gitState(deps: Deps, worktree: string): Promise<string> {
  const common = await commonDir(deps, worktree);
  const config = (
    await deps.git(worktree, [
      'config',
      '--list',
      '--show-origin',
      '--includes',
    ])
  )
    .split('\n')
    .filter((line) => !/^\S+\tbranch\./.test(line))
    .join('\n');
  const hooks = join(common, 'hooks');
  const files = [
    join(worktree, '.git'),
    ...(existsSync(hooks)
      ? (await readdir(hooks)).map((name) => join(hooks, name))
      : []),
  ];
  const parts = await Promise.all(
    files.map(async (file) => {
      const content = await readFile(file).catch(() => null);
      return `${file}\u0000${content ? sha256(content) : '-'}`;
    }),
  );
  return [sha256(config), ...parts].join('\n');
}

async function readAgentResult(file: string): Promise<AgentResult> {
  try {
    return agentResultSchema.parse(JSON.parse(await readFile(file, 'utf8')));
  } catch (error) {
    throw new Failure('resultat.json absent ou invalide', [
      error instanceof Error ? error.message.slice(0, 500) : String(error),
    ]);
  }
}

const oneLine = (text: string) => {
  const flat = text.replaceAll(/\s+/g, ' ');
  return flat.length > 200 ? `${flat.slice(0, 200)}…` : flat;
};

const problemLines = (problems: Problem[]) =>
  problems.map((p) => `${p.kind} : ${p.detail}`);

const threadLine = (thread: ThreadRef | null) =>
  thread ? `${thread.id}${thread.link ? ` (${thread.link})` : ''}` : '—';

function prBody(
  report: PulledReport,
  result: AgentResult,
  comparison: Comparison,
  thread: ThreadRef | null,
): string {
  const gains =
    comparison.gains.length > 0
      ? `Champs de l’étiquette signalée lus justes après la correction : ${comparison.gains.join(', ')}.`
      : 'Correction OCR : le banc image ne lit que les codes, elle est vérifiée par les tests synthétiques.';
  return [
    `Rapport de scan \`${neutralId(report.id)}\` (phase de test, YSL-147). L’image et sa lecture attendue sont versées au corpus privé, hors dépôt.`,
    '',
    '## Correction',
    '',
    result.resume,
    '',
    '## Banc d’extraction avant / après',
    '',
    `${comparison.labels} étiquettes, mesurées par la commande d’accroche sur \`main\` puis sur cette branche. Aucun champ ne recule.`,
    '',
    comparisonTable(comparison),
    '',
    gains,
    '',
    'Gates : `turbo run lint check-types test` sur les paquets touchés, verts.',
    '',
    thread
      ? `Agent : fil T3 \`${thread.id}\`, local au PC qui a reçu le rapport.`
      : 'Agent : session `claude -p`, sans fil T3.',
    '',
    'PR ouverte en draft par l’agent des rapports de scan : à relire et fusionner à la main.',
  ].join('\n');
}

/**
 * The `--on-report` hook: one report in, at most one draft PR out. Every
 * check that guards the public repository runs here, after the agent, and
 * not in the agent's hands.
 */
export async function handleReport(
  config: Config,
  deps: Deps,
): Promise<Outcome> {
  const state = join(dirname(config.reportDir), '.agent');
  const work = join(config.reportDir, 'agent');
  await mkdir(state, { recursive: true });
  let report: PulledReport;
  try {
    report = await readReport(config.reportId, config.reportDir);
  } catch (error) {
    if (!(error instanceof ReportError)) throw error;
    await appendFile(
      join(state, 'journal.log'),
      `${deps.now().toISOString()} rapport=${config.reportId} ignoré : ${oneLine(error.message)}\n`,
    );
    deps.log(`Rapport ${config.reportId} ignoré : ${error.message}.`);
    return { kind: 'ignored', reason: error.message };
  }
  const release = await acquireLock(join(state, 'verrou'), {
    log: deps.log,
    sleep: deps.lockSleep,
  });
  try {
    return await underLock(config, deps, report, state, work);
  } finally {
    await release();
  }
}

async function underLock(
  config: Config,
  deps: Deps,
  report: PulledReport,
  state: string,
  work: string,
): Promise<Outcome> {
  await rm(work, { recursive: true, force: true });
  await mkdir(work, { recursive: true });
  const journal = join(work, 'journal.log');
  const log = (line: string) => {
    deps.log(line);
    void appendFile(journal, `${deps.now().toISOString()} ${line}\n`);
  };
  const registryFile = join(state, 'etiquettes.json');
  const registry = await loadRegistry(registryFile);
  const { group } = attachReport(registry, report.id, labelKeys(report));
  await saveRegistry(registryFile, registry);

  let worktree: string | null = null;
  let branch = '';
  let published = '';
  let thread: ThreadRef | null = null;
  const finish = async (outcome: Outcome) => {
    const what =
      outcome.kind === 'pr'
        ? `PR draft #${outcome.pr} (${outcome.branch})`
        : outcome.kind === 'ready'
          ? `prête sans PR (${outcome.branch}, ${outcome.worktree})`
          : outcome.kind === 'attached'
            ? `rattaché à la PR #${outcome.pr}`
            : `échec : ${outcome.reason}`;
    if (outcome.kind !== 'attached' && branch) {
      group.attempts.push({
        report: report.id,
        branch,
        at: deps.now().toISOString(),
        outcome: outcome.kind,
        ...(outcome.kind === 'pr' ? { pr: outcome.pr } : {}),
      });
      await saveRegistry(registryFile, registry);
    }
    await appendFile(
      join(state, 'journal.log'),
      `${deps.now().toISOString()} rapport=${report.id} etiquette=${group.id}${thread ? ` fil=${thread.id}` : ''} ${oneLine(what)}\n`,
    );
    log(`Rapport ${report.id} : ${what}.`);
    return outcome;
  };

  try {
    const open = await openPullRequestOf(group, deps.forge);
    if (open) {
      log(
        `Étiquette ${group.id} déjà en revue (PR #${open.pr}) : pas d’agent.`,
      );
      return await finish({ kind: 'attached', pr: open.pr });
    }

    branch = await freeBranch(group, deps.forge);
    const labelId = `rapport-${neutralId(report.id)}`;
    const corpusDir = join(work, 'corpus-real');
    const imageFile = await prepareCorpus(config, report, corpusDir, labelId);

    await deps.git(config.repo, ['fetch', '--quiet', 'origin', 'main']);
    const baseSha = (
      await deps.git(config.repo, ['rev-parse', config.base])
    ).trim();
    worktree = join(config.worktrees, `ysl-${branch.slice('fix/'.length)}`);
    await deps.git(config.repo, [
      'worktree',
      'add',
      '--quiet',
      '--no-track',
      '-b',
      branch,
      worktree,
      baseSha,
    ]);
    log(`Worktree ${worktree} (${branch}) depuis ${baseSha.slice(0, 8)}.`);
    const install = await deps.exec(
      'pnpm',
      ['install', '--frozen-lockfile', '--prefer-offline'],
      {
        cwd: worktree,
        log: join(work, 'install.log'),
        timeoutMs: INSTALL_TIMEOUT_MS,
      },
    );
    if (install !== 0) throw new Failure('pnpm install en échec (install.log)');

    const bench = (out: string) =>
      deps.exec(
        'pnpm',
        [
          '--filter',
          '@repo/bench',
          'measure',
          '--corpus',
          config.corpus,
          '--private',
          corpusDir,
          '--out',
          join(work, out),
        ],
        {
          cwd: worktree!,
          log: join(work, `${out}.log`),
          timeoutMs: BENCH_TIMEOUT_MS,
          sandbox: [worktree!, work],
        },
      );

    const gitBefore = await gitState(deps, worktree);
    const prompt = fill(config.prompt, {
      REPORT_ID: report.id,
      LABEL_ID: labelId,
      REPORT_DIR: config.reportDir,
      WORKTREE: worktree,
      WORK_DIR: work,
      CORPUS_DIR: config.corpus,
      PRIVATE_DIR: corpusDir,
      IMAGE_FILE: imageFile,
      BRANCH: branch,
      RESULT_FILE: join(work, 'resultat.json'),
      REPORT_VERSION: String(SCAN_REPORT_VERSION),
    });
    log(
      `Agent ${MODEL} lancé (${config.maxTurns} tours, ${config.timeoutMs / 60_000} min au plus).`,
    );
    const agent = await deps.runAgent({
      prompt,
      title: threadTitle(report.id),
      cwd: worktree,
      gitDir: await commonDir(deps, worktree),
      workDir: work,
      env: deps.agentEnv(work),
      maxTurns: config.maxTurns,
      timeoutMs: config.timeoutMs,
      onThread: (ref) => {
        thread = ref;
        log(`Fil T3 ${threadLine(ref)}.`);
      },
    });
    thread = agent.thread ?? thread;
    if (agent.wrongModel) {
      throw new Failure(
        `agent sur ${agent.model ?? 'un modèle inconnu'} au lieu de ${MODEL}, arrêté`,
      );
    }
    if (agent.stopped) throw new Failure(agent.stopped);
    if (agent.timedOut)
      throw new Failure('agent arrêté au bout du temps imparti');
    log(
      `Agent terminé (code ${agent.code}, ${agent.result ?? 'sans résultat'}).`,
    );

    const untouched = async () => {
      if ((await gitState(deps, worktree!)) !== gitBefore) {
        throw new Failure(
          'hooks ou configuration git modifiés pendant l’agent',
        );
      }
    };
    await untouched();
    const commits = (await deps.git(worktree, ['rev-list', `${baseSha}..HEAD`]))
      .split('\n')
      .filter(Boolean);
    const remote = (
      await deps.git(config.repo, ['ls-remote', '--heads', 'origin'])
    )
      .split('\n')
      .map((line) => line.split('\t'))
      .filter(
        ([sha, ref]) =>
          ref === `refs/heads/${branch}` || (sha && commits.includes(sha)),
      )
      .map(([, ref]) => ref ?? '');
    const agentPr = await deps.forge.openPullRequest(branch);
    if (remote.length > 0 || agentPr !== null) {
      published = `par l’agent : ${[...remote, ...(agentPr ? [`PR #${agentPr}`] : [])].join(', ')}`;
      throw new Failure('l’agent a publié pendant son travail', [
        ...remote.map((ref) => `branche distante ${ref}`),
        ...(agentPr ? [`PR #${agentPr} ouverte sur ${branch}`] : []),
      ]);
    }
    const result = await readAgentResult(join(work, 'resultat.json'));
    if (result.statut === 'echec') {
      throw new Failure(
        `l’agent n’a rien corrigé : ${result.raison ?? result.resume}`,
      );
    }
    const label = await addedLabel(config, corpusDir, labelId, imageFile);
    if (commits.length === 0) throw new Failure('aucun commit sur la branche');

    const sensitive = {
      personal: [
        ...report.personal,
        ...[
          label.tracking,
          ...(label.otherTrackings ?? []),
          label.recipient,
          label.sender,
        ].filter((v): v is string => typeof v === 'string'),
      ],
      other: report.texts,
    };
    const guard = (body: string) =>
      checkBeforePush({
        git: (args) => deps.git(worktree!, args),
        base: baseSha,
        branch,
        title: result.titre,
        body,
        sensitive,
      });
    const early = await guard(result.resume);
    if (early.length > 0) {
      throw new Failure('contrôle avant push refusé', problemLines(early));
    }

    log('Gates des paquets touchés…');
    const gates = await deps.exec(
      'pnpm',
      [
        'turbo',
        'run',
        'lint',
        'check-types',
        'test',
        `--filter=...[${baseSha}]`,
        // A dependent of `@repo/contract` the agent may not touch, whose own
        // tests need git's global config and a sandbox of their own.
        '--filter=!@repo/scan-agent',
      ],
      {
        cwd: worktree,
        log: join(work, 'gates.log'),
        timeoutMs: GATES_TIMEOUT_MS,
        sandbox: [worktree, work],
      },
    );
    if (gates !== 0) throw new Failure('gates en échec (gates.log)');

    log('Banc sur main puis sur la branche…');
    await deps.git(worktree, ['checkout', '--quiet', '--detach', baseSha]);
    const before = await bench('banc-avant');
    await deps.git(worktree, ['checkout', '--quiet', branch]);
    if (before !== 0)
      throw new Failure('banc en échec sur main (banc-avant.log)');
    if ((await bench('banc-apres')) !== 0) {
      throw new Failure('banc en échec sur la branche (banc-apres.log)');
    }
    const comparison = compareResults(
      parseResults(
        JSON.parse(
          await readFile(join(work, 'banc-avant', 'results.json'), 'utf8'),
        ),
      ),
      parseResults(
        JSON.parse(
          await readFile(join(work, 'banc-apres', 'results.json'), 'utf8'),
        ),
      ),
      labelId,
    );
    await writeFile(
      join(work, 'comparaison.md'),
      `${comparisonTable(comparison)}\n`,
    );
    if (comparison.regressions.length > 0) {
      throw new Failure('régression sur le corpus', comparison.regressions);
    }
    if (comparison.gains.length === 0 && result.nature !== 'ocr') {
      throw new Failure('aucun champ de l’étiquette signalée n’est mieux lu');
    }

    const body = prBody(report, result, comparison, thread);
    const final = await guard(body);
    if (final.length > 0) {
      throw new Failure('contrôle avant push refusé', problemLines(final));
    }
    const bodyFile = join(work, 'pr.md');
    await writeFile(bodyFile, `${body}\n`);

    if (!config.openPr) {
      log(
        `--no-pr : contrôles passés, arrêt avant le push. Titre : ${result.titre} ; description : ${bodyFile}.`,
      );
      const ready = await finish({ kind: 'ready', branch, worktree });
      worktree = null;
      return ready;
    }

    if (!branch.startsWith(BRANCH_PREFIX))
      throw new Failure(`branche ${branch} refusée`);
    await untouched();
    await deps.git(worktree, [
      '-c',
      'core.hooksPath=/dev/null',
      'push',
      '--no-verify',
      '--quiet',
      'origin',
      `refs/heads/${branch}:refs/heads/${branch}`,
    ]);
    published = `branche ${branch} poussée, sans PR`;
    const pr = await deps.forge.createDraft({
      cwd: worktree,
      branch,
      title: result.titre,
      bodyFile,
    });
    published = `PR draft #${pr}`;

    try {
      const annotations = join(config.privateCorpus, 'annotations.json');
      await mkdir(config.privateCorpus, { recursive: true });
      await copyFile(report.imagePath, join(config.privateCorpus, imageFile));
      const labels = [...(await readManifest(annotations)), label];
      await writeFile(
        `${annotations}.partiel`,
        `${JSON.stringify(labels, null, 2)}\n`,
      );
      await rename(`${annotations}.partiel`, annotations);
      log(
        `Étiquette ${labelId} versée au corpus privé (${basename(config.privateCorpus)}).`,
      );
      await deps.git(config.repo, ['worktree', 'remove', '--force', worktree]);
      await deps.git(config.repo, ['branch', '-D', branch]);
      worktree = null;
    } catch (error) {
      log(
        `PR #${pr} ouverte, mais la suite a échoué (${error instanceof Error ? error.message : String(error)}) : worktree gardé (${worktree}), étiquette à verser à la main.`,
      );
    }
    return await finish({ kind: 'pr', pr, branch });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    const details = error instanceof Failure ? error.details : [];
    await writeFile(
      join(work, 'echec.md'),
      [
        `# Échec du rapport ${report.id}`,
        '',
        `- Raison : ${reason}`,
        `- Étiquette : ${group.id}`,
        `- Branche : ${branch || '—'}`,
        `- Worktree gardé : ${worktree ?? '—'}`,
        `- Publié : ${published || 'rien'}`,
        `- Fil T3 : ${threadLine(thread)}`,
        `- Dossier de travail : ${work}`,
        ...(details.length > 0
          ? ['', '## Détail', '', ...details.map((d) => `- ${d}`)]
          : []),
        '',
      ].join('\n'),
    );
    return await finish({ kind: 'failed', reason, worktree });
  }
}
