import { type ComponentProps, createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { VerifierColisScreen } from '#screens/reception/verifier-colis-screen';

describe('Vérifier un colis, nobody proposed', () => {
  const html = renderToStaticMarkup(
    createElement(VerifierColisScreen, {
      step: { index: 1, total: 1 },
      readName: 'Nora Haddad',
      candidates: [],
      fields: [],
      // What the reception used to pass: the card must not come back with it.
      addPerson: { name: 'Nora Haddad', onClick: () => {} },
    } as ComponentProps<typeof VerifierColisScreen>),
  );

  it('offers the search, and no new card: the directory is kept elsewhere', () => {
    expect(html).toContain('annuaire');
    expect(html).not.toContain('à l’annuaire');
  });
});
