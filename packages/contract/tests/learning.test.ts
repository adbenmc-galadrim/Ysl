import { describe, expect, it } from 'vitest';
import {
  CONFIDENCE,
  extractFields,
  LEARNED,
  learnedConfidence,
} from '@repo/contract/extract';

const metalworks = {
  id: 'sender-1',
  name: 'Metalworks SpA',
  nameNorm: 'metalworks spa',
};

const senderAlias = (confirmations: number) => ({
  aliasNorm: 'meta1w0rks sp4',
  senderId: metalworks.id,
  name: metalworks.name,
  confirmations,
});

const lea = (confirmations: number) => ({
  nameNorm: 'dji europe bv',
  kind: 'person' as const,
  id: 'person-1',
  name: 'Léa Fontaine',
  confirmations,
});

describe('learned confidence (§4.3 rank 8, §4.8)', () => {
  it('starts at 0.30 and climbs 0.20 a confirmation up to 0.90', () => {
    expect([0, 1, 2, 3, 4, 5, 9].map((n) => learnedConfidence(n))).toEqual([
      0, 0.3, 0.5, 0.7, 0.9, 0.9, 0.9,
    ]);
  });

  it('keeps a learned recipient below « sûr », however confirmed', () => {
    expect(learnedConfidence(4, LEARNED.recipientMax)).toBe(0.89);
    expect(learnedConfidence(20, LEARNED.recipientMax)).toBeLessThan(
      CONFIDENCE.sure,
    );
  });
});

describe('a sender alias read again', () => {
  it('finds the sender the agent took that OCR text for, as a chip at first', () => {
    const {
      sender,
      senderId,
      senderAlias: viaAlias,
    } = extractFields({
      symbols: [],
      ocr: { text: '', senderName: 'META1W0RKS SP4' },
      senders: { known: [metalworks], aliases: [senderAlias(1)] },
    });
    expect(sender).toMatchObject({
      value: 'Metalworks SpA',
      confidence: 0.3,
      level: 'none',
    });
    expect(sender?.sources[0]).toMatchObject({
      kind: 'learned',
      format: 'alias',
    });
    expect(senderId).toBe('sender-1');
    expect(viaAlias).toBe(true);
  });

  it('prefills it to verify after three confirmations, sure after four', () => {
    const read = (n: number) =>
      extractFields({
        symbols: [],
        ocr: { text: '', senderName: 'Méta1w0rks  SP4' },
        senders: { aliases: [senderAlias(n)] },
      }).sender;
    expect(read(3)).toMatchObject({ confidence: 0.7, level: 'to-verify' });
    expect(read(4)).toMatchObject({ confidence: 0.9, level: 'sure' });
  });

  it('takes the most confirmed alias when two iPhones learned it apart', () => {
    const { senderId } = extractFields({
      symbols: [],
      ocr: { text: '', senderName: 'META1W0RKS SP4' },
      senders: {
        aliases: [
          { ...senderAlias(1), senderId: 'sender-2', name: 'Autre' },
          senderAlias(2),
        ],
      },
    });
    expect(senderId).toBe('sender-1');
  });

  it('leaves another text as a bare guess', () => {
    const { sender, senderAlias: viaAlias } = extractFields({
      symbols: [],
      ocr: { text: '', senderName: 'Atelier Tissage Nord' },
      senders: { aliases: [senderAlias(4)] },
    });
    expect(sender).toMatchObject({
      value: 'Atelier Tissage Nord',
      confidence: CONFIDENCE.unvalidated,
    });
    expect(viaAlias).toBe(false);
  });
});

describe('a recipient alias read again', () => {
  it('reads the printed name as the card the agent chose, never sure', () => {
    const { recipient, recipientCard } = extractFields({
      symbols: [],
      ocr: { text: '', recipientName: 'DJI Europe B.V.' },
      recipients: [lea(2)],
    });
    expect(recipient).toMatchObject({
      value: 'Léa Fontaine',
      confidence: 0.5,
      level: 'none',
    });
    expect(recipientCard).toEqual({ kind: 'person', id: 'person-1' });

    const confirmed = extractFields({
      symbols: [],
      ocr: { text: '', recipientName: 'DJI EUROPE BV' },
      recipients: [lea(9)],
      directory: ['Léa Fontaine'],
    }).recipient;
    expect(confirmed).toMatchObject({ confidence: 0.89, level: 'to-verify' });
  });

  it('names no card for a name nobody chose', () => {
    const { recipient, recipientCard } = extractFields({
      symbols: [],
      ocr: { text: '', recipientName: 'Paul Langevin' },
      recipients: [lea(4)],
    });
    expect(recipient?.value).toBe('Paul Langevin');
    expect(recipientCard).toBeNull();
  });
});
