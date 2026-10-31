import {
  indexRecipients,
  matchRecipient,
  type RecipientIndex,
} from '@repo/contract/recipient';
import type { MatchReply, MatchRequest } from '#/features/recipient/protocol';

let index: RecipientIndex = indexRecipients([]);

self.onmessage = (event: MessageEvent<MatchRequest>) => {
  const request = event.data;
  if (request.type === 'index') {
    index = indexRecipients(request.entries, request.anchors);
    return;
  }
  const result = matchRecipient(index, request.reads, request.text);
  postMessage({ id: request.id, result } satisfies MatchReply);
};
