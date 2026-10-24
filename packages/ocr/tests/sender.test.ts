import { describe, expect, it } from 'vitest';
import { senderFromLines } from '#sender';

const lines = (...texts: string[]) => texts.map((text) => ({ text }));

describe('senderFromLines', () => {
  it('takes the company under a sender anchor on its own line', () => {
    expect(
      senderFromLines(
        lines('EXPÉDITEUR', 'ATELIER TISSAGE NORD', '4 RUE DES FILATURES'),
      ),
    ).toBe('ATELIER TISSAGE NORD');
  });

  it('takes the rest of the anchor line when the name follows the label', () => {
    expect(senderFromLines(lines('From : Metalworks SpA', 'Via Roma 12'))).toBe(
      'Metalworks SpA',
    );
    expect(senderFromLines(lines('SHIPPER:ACME SARL'))).toBe('ACME SARL');
  });

  it('reads the bilingual German label and skips the twin anchor', () => {
    expect(
      senderFromLines(
        lines('Absender / Expéditeur', 'PEARL.GmbH', 'Pearl-Str. 1-3'),
      ),
    ).toBe('PEARL.GmbH');
  });

  it('keeps a person as sender when no company signs the block', () => {
    expect(
      senderFromLines(lines('EXP :', 'Camille Morel', '75007 PARIS')),
    ).toBe('Camille Morel');
  });

  it('skips address, postcode and phone lines', () => {
    expect(
      senderFromLines(
        lines(
          'EXPÉDITEUR',
          '12 RUE DES LILAS',
          '59100 ROUBAIX',
          'TEL 03 20 00 00 00',
        ),
      ),
    ).toBeNull();
  });

  it('never crosses into the recipient block', () => {
    expect(
      senderFromLines(lines('FROM', 'DESTINATAIRE', 'Camille Morel')),
    ).toBeNull();
  });

  it('returns null without a sender anchor', () => {
    expect(
      senderFromLines(lines('SHIP TO', 'Camille Morel', 'Metalworks SpA')),
    ).toBeNull();
    expect(
      senderFromLines(lines('EXPRESS SAVER', 'Metalworks SpA')),
    ).toBeNull();
  });

  it('ignores tracking and reference lines after the anchor', () => {
    expect(
      senderFromLines(
        lines(
          'SHIP FROM',
          'REF 4521-A',
          'TRACKING 1Z E63 44W',
          'Frölich & Kaufmann',
        ),
      ),
    ).toBe('Frölich & Kaufmann');
  });
});
