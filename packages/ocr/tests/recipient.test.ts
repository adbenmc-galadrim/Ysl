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

  it('gives nothing without an anchor, or when only digits follow', () => {
    expect(
      recipientFromLines(lines('Camille MOREL', '12 RUE DES LILAS')),
    ).toBeNull();
    expect(
      recipientFromLines(lines('DESTINATAIRE', '8J25313273378', 'A4 PRINT')),
    ).toBeNull();
    expect(recipientFromLines(lines('A LA REVUE DES DEUX MONDES'))).toBeNull();
  });
});
