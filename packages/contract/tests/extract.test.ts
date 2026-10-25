import { describe, expect, it } from 'vitest';
import { EOT, GS, RS } from '@repo/contract/codes';
import {
  CONFIDENCE,
  combine,
  extractFields,
  levelOf,
} from '@repo/contract/extract';

const dpdAztec = (
  tracking: string,
  recipient = 'MARIE CURIE',
  network: 'GEOP' | 'CHRO' = 'GEOP',
) =>
  `[)>${RS}01${GS}02${GS}75007${GS}250${GS}328${GS}${tracking}${GS}${network}${GS}123456${GS}${GS}${GS}001/002${GS}01.50KG${GS}N${GS}24 RUE DE L UNIVERSITE${GS}PARIS${GS}${GS}${recipient}${GS}${RS}${EOT}`;

const fedexPdf417 = (tracking: string) =>
  `[)>${RS}01${GS}0275007${GS}250${GS}020${GS}${tracking}${GS}FDE${GS}123456789${GS}042${GS}${GS}1/1${GS}0.50KG${GS}N${GS}24 RUE DE L UNIVERSITE${GS}PARIS${GS}IDF${GS}PAUL LANGEVIN${RS}06${GS}10ZGD003${GS}11ZACME SRL${GS}12Z+33612345678${RS}${EOT}`;

const DPD = '01234567890128';
const UPS = '1Z12345E0205271686';
const FEDEX = '794644790131';

describe('confidence', () => {
  it('combines independent sources and caps at 0.99', () => {
    expect(combine([0.97, 0.95])).toBe(0.99);
    expect(combine([0.85, 0.85])).toBeCloseTo(0.9775, 4);
    expect(combine([0.4])).toBe(0.4);
  });

  it('maps confidences to the display levels of §4.4', () => {
    expect(levelOf(0.9)).toBe('sure');
    expect(levelOf(0.89)).toBe('to-verify');
    expect(levelOf(0.6)).toBe('to-verify');
    expect(levelOf(0.59)).toBe('none');
  });
});

describe('extractFields — tracking', () => {
  it('reads a sure 1D tracking at 0.95', () => {
    const { tracking, carrier } = extractFields({
      symbols: [{ format: 'Code128', text: UPS }],
    });
    expect(tracking).toMatchObject({
      value: UPS,
      confidence: CONFIDENCE.keyed1d,
      level: 'sure',
      flags: [],
    });
    expect(tracking?.sources).toEqual([
      { kind: '1d', format: 'Code128', confidence: 0.95, value: UPS },
    ]);
    expect(carrier).toMatchObject({ value: 'ups', level: 'sure' });
  });

  it('keeps a format-only 1D tracking at 0.85, to verify', () => {
    const { tracking, carrier } = extractFields({
      symbols: [{ format: 'Code128', text: DPD }],
    });
    expect(tracking).toMatchObject({
      value: DPD,
      confidence: CONFIDENCE.format1d,
      level: 'to-verify',
    });
    expect(carrier).toBeNull();
  });

  it('drops a rejected 1D number and reads nothing', () => {
    const { tracking, carrier } = extractFields({
      symbols: [{ format: 'Code128', text: '1Z12345E0205271687' }],
    });
    expect(tracking).toBeNull();
    expect(carrier).toBeNull();
  });

  it('takes a structured 2D tracking at 0.97', () => {
    const { tracking, carrier, recipient, pieces, weightKg } = extractFields({
      symbols: [{ format: 'Aztec', text: dpdAztec(DPD) }],
    });
    expect(tracking).toMatchObject({ value: DPD, confidence: 0.97 });
    expect(carrier).toMatchObject({ value: 'dpd', confidence: 0.97 });
    expect(recipient).toMatchObject({ value: 'MARIE CURIE', level: 'sure' });
    expect(pieces).toMatchObject({ value: { index: 1, total: 2 } });
    expect(weightKg).toMatchObject({ value: 1.5 });
  });

  it('does not trust a structured field whose number has no known shape', () => {
    const { tracking, carrier } = extractFields({
      symbols: [
        { format: 'Aztec', text: dpdAztec('HA123456789012', 'X', 'CHRO') },
      ],
    });
    expect(tracking).toMatchObject({
      value: 'HA123456789012',
      confidence: CONFIDENCE.format1d,
      level: 'to-verify',
    });
    expect(carrier).toMatchObject({ value: 'chronopost', level: 'sure' });
  });

  it('keeps the other fields of a code whose tracking fails its key', () => {
    const maxicode = `[)>${RS}01${GS}9675007${GS}250${GS}011${GS}1ZE0205271${GS}UPSN${GS}12345E${GS}042${GS}${GS}1/2${GS}3${GS}N${GS}${GS}PARIS${GS}${RS}${EOT}`;
    const { tracking, carrier, pieces, weightKg } = extractFields({
      symbols: [{ format: 'MaxiCode', text: maxicode }],
    });
    expect(tracking).toBeNull();
    expect(carrier).toMatchObject({ value: 'ups', level: 'sure' });
    expect(pieces).toMatchObject({ value: { index: 1, total: 2 } });
    expect(weightKg?.value).toBeCloseTo(1.36, 2);
  });

  it('raises an agreeing 2D and 1D pair to the cap', () => {
    const { tracking, carrier } = extractFields({
      symbols: [
        { format: 'Aztec', text: dpdAztec(DPD) },
        { format: 'Code128', text: `%007500701234567890128101250` },
      ],
    });
    expect(tracking).toMatchObject({ value: DPD, confidence: 0.99, flags: [] });
    expect(tracking?.sources.map((s) => s.kind)).toEqual(['2d', '1d']);
    expect(carrier?.sources).toHaveLength(2);
  });

  it('keeps the best-ranked source with a malus when sources disagree', () => {
    const { tracking } = extractFields({
      symbols: [
        { format: 'Aztec', text: dpdAztec(DPD) },
        { format: 'Code128', text: UPS },
      ],
    });
    expect(tracking).toMatchObject({
      value: DPD,
      confidence: 0.82,
      level: 'to-verify',
      flags: ['conflict'],
    });
    expect(tracking?.candidates.map((c) => c.value)).toEqual([DPD, UPS]);
  });

  it('keeps a code of unknown shape as noise, not as a contradiction', () => {
    const { tracking } = extractFields({
      symbols: [
        { format: 'Aztec', text: dpdAztec(DPD) },
        { format: 'Code128', text: '%007500701234567890128101250X' },
      ],
    });
    expect(tracking).toMatchObject({ value: DPD, confidence: 0.97, flags: [] });
    expect(tracking?.candidates[1]).toMatchObject({
      confidence: CONFIDENCE.unvalidated,
    });
  });

  it('validates a 1D number in the context of the 2D carrier', () => {
    const { tracking } = extractFields({
      symbols: [
        { format: 'PDF417', text: fedexPdf417(FEDEX) },
        { format: 'Code128', text: FEDEX },
      ],
    });
    expect(tracking).toMatchObject({ value: FEDEX, confidence: 0.99 });
  });
});

describe('extractFields — carrier vote', () => {
  it('lets the 2D network outvote a 1D format', () => {
    const { carrier } = extractFields({
      symbols: [
        { format: 'Aztec', text: dpdAztec(DPD) },
        { format: 'Code128', text: UPS },
      ],
    });
    expect(carrier).toMatchObject({
      value: 'dpd',
      flags: ['conflict'],
      level: 'to-verify',
    });
    expect(carrier?.candidates.map((c) => c.value)).toEqual(['dpd', 'ups']);
  });

  it('cannot be sure on a tie', () => {
    const { carrier } = extractFields({
      symbols: [
        { format: 'Aztec', text: dpdAztec(DPD) },
        { format: 'PDF417', text: fedexPdf417(FEDEX) },
      ],
    });
    expect(carrier?.flags).toEqual(['conflict', 'tie']);
    expect(carrier?.level).toBe('to-verify');
  });

  it('names the carrier of a shape shared by several carriers to verify', () => {
    const { tracking, carrier } = extractFields({
      symbols: [{ format: 'Code128', text: FEDEX }],
    });
    expect(tracking).toMatchObject({ value: FEDEX, level: 'sure' });
    expect(carrier).toMatchObject({
      value: 'fedex',
      confidence: CONFIDENCE.format1d,
      level: 'to-verify',
    });
  });
});

describe('extractFields — parties', () => {
  it('groups the same name written differently', () => {
    const { recipient } = extractFields({
      symbols: [
        { format: 'Aztec', text: dpdAztec(DPD, 'Marie CURIE') },
        { format: 'Aztec', text: dpdAztec(DPD, 'MARIE  CURIE') },
      ],
    });
    expect(recipient).toMatchObject({ confidence: 0.99, flags: [] });
  });

  it('reads the FedEx sender and ranks a second recipient', () => {
    const { sender, recipient } = extractFields({
      symbols: [
        { format: 'PDF417', text: fedexPdf417(FEDEX) },
        { format: 'Aztec', text: dpdAztec(DPD) },
      ],
    });
    expect(sender).toMatchObject({ value: 'ACME SRL', level: 'sure' });
    expect(recipient?.candidates).toHaveLength(2);
    expect(recipient?.flags).toEqual(['conflict']);
  });
});

describe('extractFields — inputs', () => {
  it('returns empty fields without symbols', () => {
    expect(extractFields({ symbols: [] })).toEqual({
      tracking: null,
      carrier: null,
      recipient: null,
      sender: null,
      senderId: null,
      accounts: [],
      pieces: null,
      weightKg: null,
      service: null,
      reference: null,
      codes: [],
    });
  });

  it('reads the service and the reference of a structured code', () => {
    const { service, reference } = extractFields({
      symbols: [{ format: 'PDF417', text: fedexPdf417(FEDEX) }],
    });
    expect(service).toMatchObject({
      value: { code: '020', label: 'Express Saver' },
      confidence: 0.97,
      level: 'sure',
    });
    expect(service?.sources).toEqual([
      {
        kind: '2d',
        format: 'PDF417',
        confidence: 0.97,
        value: 'Express Saver',
      },
    ]);
    expect(reference).toBeNull();
  });

  it('keeps a service code the carrier does not name', () => {
    const { service } = extractFields({
      symbols: [{ format: 'Aztec', text: dpdAztec(DPD) }],
    });
    expect(service).toMatchObject({
      value: { code: '328', label: null },
      sources: [{ value: '328' }],
    });
  });

  it('reads a GS1 reference and a shipment id as the reference', () => {
    const { reference } = extractFields({
      symbols: [
        { format: 'DataMatrix', text: '(00)340123450000000012(401)REF-42' },
      ],
    });
    expect(reference).toMatchObject({ value: 'REF-42', confidence: 0.97 });
  });

  it('derives the UPS service from the 1Z alone, at 0.93', () => {
    const { service } = extractFields({
      symbols: [{ format: 'Code128', text: UPS }],
    });
    expect(service).toMatchObject({
      value: { code: '02', label: '2nd Day Air' },
      confidence: CONFIDENCE.derived,
      level: 'sure',
      sources: [{ kind: '1d', format: 'Code128' }],
    });
  });

  it('marks a registered S10 item from its number', () => {
    const { service } = extractFields({
      symbols: [{ format: 'Code128', text: 'RA123456785FR' }],
    });
    expect(service).toMatchObject({
      value: { code: null, label: 'Recommandé' },
      confidence: CONFIDENCE.derived,
    });
  });

  it('combines the MaxiCode service with the 1Z that agrees', () => {
    const maxicode = `[)>${RS}01${GS}9675007${GS}250${GS}002${GS}1Z0205271686${GS}UPSN${GS}12345E${GS}042${GS}${GS}1/1${GS}3${GS}N${GS}${GS}PARIS${GS}${RS}${EOT}`;
    const { service } = extractFields({
      symbols: [
        { format: 'MaxiCode', text: maxicode },
        { format: 'Code128', text: UPS },
      ],
    });
    expect(service).toMatchObject({
      value: { code: '02', label: '2nd Day Air' },
      confidence: 0.99,
      flags: [],
    });
    expect(service?.sources.map((s) => s.kind)).toEqual(['2d', '1d']);
  });
});

describe('extractFields — sender', () => {
  const ups = [{ format: 'Code128' as const, text: UPS }];
  const metalworks = {
    id: 'sender-1',
    name: 'Metalworks SpA',
    nameNorm: 'metalworks spa',
  };
  const account = (confirmations: number) => ({
    carrier: 'ups',
    accountNumber: '12345e',
    senderId: metalworks.id,
    name: metalworks.name,
    confirmations,
  });

  it('prefills the sender of a known UPS account at 0.90', () => {
    const { sender, senderId } = extractFields({
      symbols: ups,
      senders: { accounts: [account(1)] },
    });
    expect(sender).toMatchObject({
      value: 'Metalworks SpA',
      confidence: CONFIDENCE.learnedAccount,
      level: 'sure',
      flags: [],
    });
    expect(sender?.sources).toEqual([
      {
        kind: 'learned',
        format: 'account:ups',
        confidence: 0.9,
        value: 'Metalworks SpA',
      },
    ]);
    expect(senderId).toBe('sender-1');
  });

  it('rises to 0.95 once the account was confirmed three times', () => {
    const { sender } = extractFields({
      symbols: ups,
      senders: { accounts: [account(3)] },
    });
    expect(sender?.confidence).toBe(CONFIDENCE.learnedAccountConfirmed);
  });

  it('leaves the sender empty when the account is unknown, account kept', () => {
    const { sender, senderId, accounts } = extractFields({
      symbols: ups,
      senders: { accounts: [{ ...account(5), accountNumber: '99999X' }] },
    });
    expect(sender).toBeNull();
    expect(senderId).toBeNull();
    expect(accounts).toEqual([{ carrier: 'ups', accountNumber: '12345E' }]);
  });

  it('reads the account of a structured code too', () => {
    const { sender } = extractFields({
      symbols: [{ format: 'PDF417', text: fedexPdf417(FEDEX) }],
      senders: {
        accounts: [
          {
            carrier: 'fedex',
            accountNumber: '123456789',
            senderId: 'sender-2',
            name: 'ACME SRL',
            confirmations: 0,
          },
        ],
      },
    });
    expect(sender).toMatchObject({ value: 'ACME SRL', confidence: 0.99 });
    expect(sender?.sources.map((s) => s.kind)).toEqual(['2d', 'learned']);
  });

  it('flags a code and the dictionary that disagree, the code first', () => {
    const { sender, senderId } = extractFields({
      symbols: [{ format: 'PDF417', text: fedexPdf417(FEDEX) }],
      senders: {
        accounts: [
          {
            carrier: 'fedex',
            accountNumber: '123456789',
            senderId: 'sender-1',
            name: 'Metalworks SpA',
            confirmations: 3,
          },
        ],
      },
    });
    expect(sender).toMatchObject({
      value: 'ACME SRL',
      confidence: 0.82,
      level: 'to-verify',
      flags: ['conflict'],
    });
    expect(senderId).toBeNull();
  });

  it('shows an OCR sender alone as a bare guess at 0.40', () => {
    const { sender, senderId } = extractFields({
      symbols: ups,
      ocr: { text: '', senderName: 'Atelier Tissage Nord' },
    });
    expect(sender).toMatchObject({
      value: 'Atelier Tissage Nord',
      confidence: CONFIDENCE.unvalidated,
      level: 'none',
    });
    expect(sender?.sources).toEqual([
      {
        kind: 'ocr',
        format: 'block',
        confidence: 0.4,
        value: 'Atelier Tissage Nord',
      },
    ]);
    expect(senderId).toBeNull();
  });

  it('takes a known sender the OCR spells the same, to verify', () => {
    const { sender, senderId } = extractFields({
      symbols: ups,
      ocr: { text: '', senderName: 'METALWORKS S.P.A.' },
      senders: { known: [metalworks] },
    });
    expect(sender).toMatchObject({
      value: 'Metalworks SpA',
      confidence: CONFIDENCE.knownSender,
      level: 'to-verify',
    });
    expect(senderId).toBe('sender-1');
  });

  it('takes a known sender the OCR nearly spells, lower', () => {
    const { sender, senderId } = extractFields({
      symbols: ups,
      ocr: { text: '', senderName: 'METALW0RKS SPA' },
      senders: { known: [metalworks] },
    });
    expect(sender).toMatchObject({
      value: 'Metalworks SpA',
      confidence: CONFIDENCE.knownSenderFuzzy,
      level: 'to-verify',
    });
    expect(senderId).toBe('sender-1');
    expect(sender?.candidates).toHaveLength(1);
  });

  it('keeps a stranger as a guess instead of the nearest known sender', () => {
    const { sender, senderId } = extractFields({
      symbols: ups,
      ocr: { text: '', senderName: 'Atelier Tissage Nord' },
      senders: { known: [metalworks] },
    });
    expect(sender).toMatchObject({
      value: 'Atelier Tissage Nord',
      level: 'none',
    });
    expect(senderId).toBeNull();
  });

  it('lets the account confirm an OCR match of the same sender', () => {
    const { sender, senderId } = extractFields({
      symbols: ups,
      ocr: { text: '', senderName: 'Metalworks SpA' },
      senders: { accounts: [account(0)], known: [metalworks] },
    });
    expect(sender).toMatchObject({ value: 'Metalworks SpA', level: 'sure' });
    expect(sender?.sources.map((s) => s.format)).toEqual([
      'account:ups',
      'sender',
    ]);
    expect(senderId).toBe('sender-1');
  });
});
