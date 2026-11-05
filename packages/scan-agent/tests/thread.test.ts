import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { MODEL } from '#agent';
import {
  runThread,
  type ThreadDeps,
  type ThreadRun,
  threadTitle,
} from '#thread';

type State = {
  status: string;
  model: string;
  provider: string;
  pending: number;
  marker: boolean;
};

let run: ThreadRun;
let calls: string[][];
let inputs: (string | undefined)[];
let states: State[];
let clock: number;
let stops: number;
let duringPoll: () => Promise<void>;

const ok: State = {
  status: 'running',
  model: MODEL,
  provider: 'claudeAgent',
  pending: 0,
  marker: true,
};

const deps = (): ThreadDeps => ({
  t3: async (args, input) => {
    calls.push(args);
    inputs.push(input);
    if (args[0] === 'project') {
      return {
        code: 1,
        stdout: '[01:59:41] ERROR (#2): ProjectAlreadyExistsError: …',
        stderr: '',
      };
    }
    if (args[1] === 'start') {
      return {
        code: 0,
        stdout: JSON.stringify({ threadId: 'mcp:fil-1', runId: 'run:1' }),
        stderr: '',
      };
    }
    const state = (states.length > 1 ? states.shift() : states[0]) ?? ok;
    if (state.marker) await writeFile(join(run.workDir, 'fil-isole'), '');
    await duringPoll();
    return {
      code: 0,
      stdout: JSON.stringify({
        thread: {
          threadId: 'mcp:fil-1',
          link: '<t3-thread://v2/env/mcp:fil-1>',
          status: state.status,
          activeRunId: state.status === 'running' ? 'run:1' : null,
          providerInstanceId: state.provider,
          model: state.model,
          pendingRequestCount: state.pending,
        },
        messages: [],
      }),
      stderr: '',
    };
  },
  stopSession: () => {
    stops += 1;
    return Promise.resolve(1);
  },
  sleep: (ms) => {
    clock += ms;
    return Promise.resolve();
  },
  now: () => clock,
});

beforeEach(async () => {
  const root = await mkdtemp(join(tmpdir(), 'scan-agent-thread-'));
  const work = join(root, 'rapport', 'agent');
  await mkdir(work, { recursive: true });
  run = {
    prompt: 'Le prompt versionné',
    title: threadTitle('0b5e1c3a-7d2f-4e8b-9a61-2f4c8d0e6b17'),
    cwd: join(root, 'fils', 'ysl-scan-etiquette-0b5e1c3a'),
    gitDir: join(root, 'ysl', '.git'),
    workDir: work,
    env: {},
    maxTurns: 10,
    timeoutMs: 60 * 60_000,
    root: join(root, 'fils'),
    identity: null,
    plugins: [],
    guard: ['/bin/node', '/garde.ts'],
  };
  calls = [];
  inputs = [];
  states = [];
  clock = 0;
  stops = 0;
  duringPoll = () => Promise.resolve();
});

describe('runThread', () => {
  it('starts an Opus 5.5 thread in its own project, the prompt on stdin, and waits for its end', async () => {
    states = [ok, ok, { ...ok, status: 'completed' }];
    const outcome = await runThread(run, deps());
    expect(outcome).toMatchObject({
      result: 'completed',
      model: MODEL,
      wrongModel: false,
      timedOut: false,
      thread: { id: 'mcp:fil-1', link: '<t3-thread://v2/env/mcp:fil-1>' },
    });
    expect(outcome.stopped).toBeUndefined();
    expect(calls[1]).toEqual([
      'thread',
      'start',
      '--provider',
      'claudeAgent',
      '--model',
      'claude-opus-5-5',
      '--title',
      'Rapport de scan 0b5e1c3a',
      '--json',
      run.root,
      '-',
    ]);
    expect(inputs[1]).toBe('Le prompt versionné');
    const settings = JSON.parse(
      await readFile(join(run.root, '.claude', 'settings.json'), 'utf8'),
    ) as {
      sandbox: { enabled: boolean };
    };
    expect(settings.sandbox.enabled).toBe(true);
    expect(stops).toBe(0);
  });

  it('waits for a thread not yet running nor told its model', async () => {
    states = [
      { ...ok, status: 'idle', marker: false },
      { ...ok, provider: '', model: '' },
      ok,
      { ...ok, status: 'completed' },
    ];
    const outcome = await runThread(run, deps());
    expect(outcome).toMatchObject({
      result: 'completed',
      wrongModel: false,
      model: MODEL,
    });
    expect(outcome.stopped).toBeUndefined();
  });

  it('stops a thread that is not on Opus 5.5', async () => {
    states = [{ ...ok, model: 'claude-fable-5-1' }];
    const outcome = await runThread(run, deps());
    expect(outcome).toMatchObject({
      wrongModel: true,
      model: 'claude-fable-5-1',
    });
    expect(stops).toBe(1);
  });

  it('stops a thread waiting for an answer, and says so', async () => {
    states = [ok, { ...ok, pending: 1 }];
    const outcome = await runThread(run, deps());
    expect(outcome.stopped).toBe('le fil attend une réponse (fil arrêté)');
    expect(stops).toBe(1);
  });

  it('stops a thread that never read the settings', async () => {
    states = [{ ...ok, marker: false }];
    const outcome = await runThread(run, deps());
    expect(outcome.stopped).toMatch(
      /^réglages d’isolement du projet T3 non lus/,
    );
    expect(existsSync(join(run.workDir, 'fil-isole'))).toBe(false);
  });

  it('stops a thread whose settings changed under it', async () => {
    duringPoll = () =>
      writeFile(join(run.root, '.claude', 'settings.json'), '{}');
    const outcome = await runThread(run, deps());
    expect(outcome.stopped).toMatch(/^réglages d’isolement modifiés/);
  });

  it('stops a thread past its time', async () => {
    run.timeoutMs = 60_000;
    const outcome = await runThread(run, deps());
    expect(outcome.timedOut).toBe(true);
    expect(outcome.stopped).toMatch(/^délai dépassé/);
    expect(stops).toBe(1);
  });
});
