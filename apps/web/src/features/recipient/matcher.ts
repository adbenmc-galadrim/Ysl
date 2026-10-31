import {
  indexRecipients,
  matchRecipient,
  type RecipientEntry,
  type RecipientIndex,
  type RecipientRead,
  type RecipientResult,
} from '@repo/contract/recipient';
import type { MatchReply, MatchRequest } from '#/features/recipient/protocol';

/** Where the matching runs: a Worker in the app, the calling thread where there is none. */
export type MatchEngine = {
  setEntries(entries: RecipientEntry[], anchors?: string[]): void;
  match(reads: RecipientRead[], text?: string | null): Promise<RecipientResult>;
};

/** The same matching, on the calling thread: tests, and browsers without Workers. */
export class InlineMatcher implements MatchEngine {
  private index: RecipientIndex = indexRecipients([]);

  setEntries(entries: RecipientEntry[], anchors: string[] = []) {
    this.index = indexRecipients(entries, anchors);
  }

  match(reads: RecipientRead[], text: string | null = null) {
    return Promise.resolve(matchRecipient(this.index, reads, text));
  }
}

type Pending = {
  reads: RecipientRead[];
  text: string | null;
  resolve: (result: RecipientResult) => void;
};

/**
 * The matching off the main thread (§4.1: the extraction never blocks the
 * agent). The Worker keeps the prepared directory; each reading only sends
 * the names and the text. Messages keep their order, so a match always
 * sees the directory sent before it. A Worker that fails hands its pending
 * and later matches to the calling thread rather than leaving them unanswered.
 */
class WorkerMatcher implements MatchEngine {
  private worker: Worker | undefined;
  private fallback: InlineMatcher | undefined;
  private entries: RecipientEntry[] = [];
  private anchors: string[] = [];
  private nextId = 0;
  private readonly pending = new Map<number, Pending>();

  setEntries(entries: RecipientEntry[], anchors: string[] = []) {
    this.entries = entries;
    this.anchors = anchors;
    if (this.fallback) this.fallback.setEntries(entries, anchors);
    else this.post({ type: 'index', entries, anchors });
  }

  match(reads: RecipientRead[], text: string | null = null) {
    if (this.fallback) return this.fallback.match(reads, text);
    const id = this.nextId++;
    return new Promise<RecipientResult>((resolve) => {
      this.pending.set(id, { reads, text, resolve });
      this.post({ type: 'match', id, reads, text });
    });
  }

  private post(request: MatchRequest) {
    this.started().postMessage(request);
  }

  private fail() {
    this.worker?.terminate();
    const fallback = new InlineMatcher();
    fallback.setEntries(this.entries, this.anchors);
    this.fallback = fallback;
    for (const { reads, text, resolve } of this.pending.values()) {
      void fallback.match(reads, text).then(resolve);
    }
    this.pending.clear();
  }

  private started(): Worker {
    if (this.worker) return this.worker;
    const worker = new Worker(new URL('./match.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.addEventListener('message', (event: MessageEvent<MatchReply>) => {
      const { id, result } = event.data;
      const request = this.pending.get(id);
      this.pending.delete(id);
      request?.resolve(result);
    });
    worker.addEventListener('error', () => this.fail());
    this.worker = worker;
    return worker;
  }
}

let engine: MatchEngine | undefined;

export function recipientMatcher(): MatchEngine {
  engine ??=
    typeof Worker === 'undefined' ? new InlineMatcher() : new WorkerMatcher();
  return engine;
}
