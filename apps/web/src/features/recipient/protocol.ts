import type {
  RecipientEntry,
  RecipientRead,
  RecipientResult,
} from '@repo/contract/recipient';

export type MatchRequest =
  | { type: 'index'; entries: RecipientEntry[]; anchors: string[] }
  | {
      type: 'match';
      id: number;
      reads: RecipientRead[];
      text: string | null;
    };

export type MatchReply = { id: number; result: RecipientResult };
