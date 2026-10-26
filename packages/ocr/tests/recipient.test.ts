import { describe, expect, it } from 'vitest';
import { recipientFromLines } from '#recipient';

const lines = (...texts: string[]) => texts.map((text) => ({ text }));

describe('recipientFromLines', () => {
  it('takes the line that follows a recipient anchor', () => {
    expect(
      recipientFromLines(
        lines(
          'COLISSIMO',
          'DESTINATAIRE',
          'Camille MOREL',
          '12 RUE DES LILAS',
          '75007 PARIS',
        ),
      ),
    ).toBe('Camille MOREL');
  });

  it('reads the name on the anchor line itself', () => {
    expect(
      recipientFromLines(lines('Ship to: Hugo Lefèvre', '24 av. Montaigne')),
    ).toBe('Hugo Lefèvre');
    expect(recipientFromLines(lines('À : Mme Jade Mercier'))).toBe(
      'Jade Mercier',
    );
    expect(recipientFromLines(lines('DESTINATAIRE:Camille Morel'))).toBe(
      'Camille Morel',
    );
  });

  it('skips a company and a street to reach the person', () => {
    expect(
      recipientFromLines(
        lines('SHIP TO', 'ACME SAS', 'Raphaël Nguyen', '3 PLACE VENDOME'),
      ),
    ).toBe('Raphaël Nguyen');
    expect(
      recipientFromLines(
        lines('DELIVER TO:', 'PRINT & PAPER LTD', '12 RUE DU BAC', 'PARIS'),
      ),
    ).toBeNull();
  });

  it('never crosses into the sender block', () => {
    expect(
      recipientFromLines(
        lines('DESTINATAIRE', '', 'EXPEDITEUR', 'Louis Bernard', 'LYON'),
      ),
    ).toBeNull();
  });

  it('takes a last name after its initial, not a lone word', () => {
    expect(
      recipientFromLines(lines('DESTINATAIRE :', 'L. FONTAINE', 'PARIS')),
    ).toBe('L. FONTAINE');
    expect(recipientFromLines(lines('DESTINATAIRE:', 'L.FONTAINE'))).toBe(
      'L. FONTAINE',
    );
    expect(recipientFromLines(lines('DESTINATAIRE :', 'FONTAINE'))).toBeNull();
    expect(
      recipientFromLines(lines('DESTINATAIRE :', 'L FONTAINE')),
    ).toBeNull();
  });

  it('never takes the host company for the person', () => {
    expect(
      recipientFromLines(
        lines('DESTINATAIRE', 'SAINT LAURENT', 'Léa FONTAINE', '75007 PARIS'),
      ),
    ).toBe('Léa FONTAINE');
    expect(recipientFromLines(lines('SHIP TO: YSL Léa Fontaine'))).toBe(
      'Léa Fontaine',
    );
  });

  it('reads the CONTACT line when no anchor shows (v1)', () => {
    expect(
      recipientFromLines(lines('DPD', 'CONTACT : Hugo Lefèvre', 'TEL 0102')),
    ).toBe('Hugo Lefèvre');
    expect(
      recipientFromLines(lines('C0NTACT', 'Hugo Lefèvre', '24 av. Montaigne')),
    ).toBe('Hugo Lefèvre');
  });

  it('looks around the host company, then above its street (v1)', () => {
    expect(
      recipientFromLines(
        lines('GLS', 'SA1NT LAURENT', 'Nora HADDAD', '37 RUE DE BELLECHASSE'),
      ),
    ).toBe('Nora HADDAD');
    expect(
      recipientFromLines(lines('Nora HADDAD', 'SAINT LAURENT', '75007 PARIS')),
    ).toBe('Nora HADDAD');
    expect(
      recipientFromLines(
        lines('Léa Fontaine', '3e étage', '37 RUE DE BELLECHASSE', 'PARIS'),
      ),
    ).toBe('Léa Fontaine');
  });

  it('keeps the landmarks out of the sender block', () => {
    expect(
      recipientFromLines(lines('FROM: Louis Bernard', 'SAINT LAURENT')),
    ).toBeNull();
  });

  it('gives nothing without an anchor, or when only digits follow', () => {
    expect(
      recipientFromLines(lines('Camille MOREL', '12 RUE DES LILAS')),
    ).toBeNull();
    expect(
      recipientFromLines(lines('DESTINATAIRE', '8J25313273378', 'A4 PRINT')),
    ).toBeNull();
    expect(recipientFromLines(lines('A LA REVUE DES DEUX MONDES'))).toBeNull();
  });

  it('stops at the wider sender anchors too (SHIPPER, ABSENDER)', () => {
    expect(
      recipientFromLines(
        lines('SHIP TO', 'SHIPPER: ACME SARL', 'Camille Morel'),
      ),
    ).toBeNull();
    expect(
      recipientFromLines(lines('DESTINATAIRE', 'Absender', 'Camille Morel')),
    ).toBeNull();
  });
});
