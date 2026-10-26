export {
  BEST_SCORE,
  EXACT_SCORE,
  FUZZY_MIN_LENGTH,
  indexRecipients,
  matchRecipient,
  MIN_SCORE,
  PREFIX_MIN_LENGTH,
  silentMatch,
  SUGGESTIONS,
} from './match';
export type {
  ReadSource,
  RecipientEntry,
  RecipientIndex,
  RecipientKind,
  RecipientMatch,
  RecipientRead,
  RecipientResult,
} from './match';
export {
  fixOcrWord,
  readableName,
  readTokens,
  toTitle,
  withinOneEdit,
} from './words';
