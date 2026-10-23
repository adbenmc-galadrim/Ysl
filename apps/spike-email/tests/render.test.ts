import { describe, expect, it } from 'vitest';
import { DEFAULT_FIELDS, DEFAULT_TEMPLATE } from '#/templates/default';
import { render, templateValues } from '#/templates/render';

describe('render', () => {
  it('replaces every known variable', () => {
    expect(
      render('Bonjour {prénom} {nom}, code {code}.', {
        prénom: 'Nora',
        nom: 'Haddad',
        code: '4821',
      }),
    ).toEqual({ text: 'Bonjour Nora Haddad, code 4821.', unknown: [] });
  });

  it('leaves an unknown variable visible and lists it once', () => {
    expect(render('{xyz} et {xyz} {code}', { code: '4821' })).toEqual({
      text: '{xyz} et {xyz} 4821',
      unknown: ['xyz'],
    });
  });

  it('does not substitute a variable found inside a value', () => {
    expect(render('{nom}', { nom: '{code}', code: '4821' }).text).toBe(
      '{code}',
    );
  });
});

describe('templateValues', () => {
  it('turns the parcels into a bulleted list, blank lines dropped', () => {
    const values = templateValues(
      { ...DEFAULT_FIELDS, colis: 'Amazon ···4471\n\n  DHL ···9  \n' },
      'courrier@exemple.fr',
    );

    expect(values.colis).toBe('• Amazon ···4471\n• DHL ···9');
  });

  it('renders the default template without leftover variables', () => {
    const values = templateValues(DEFAULT_FIELDS, 'courrier@exemple.fr');

    const body = render(DEFAULT_TEMPLATE.body, values);

    expect(body.unknown).toEqual([]);
    expect(body.text).toContain('Donnez ce code au comptoir : 4821');
    expect(body.text).toContain(
      'mailto:courrier@exemple.fr?subject=Ce%20n%E2%80%99est%20pas%20%C3%A0%20moi%20%C2%B7%20code%204821',
    );
  });
});
