import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { type ScanField, ScanFields } from '#components/scan-fields';

const render = (fields: ScanField[], tone: 'dark' | 'light' = 'dark') =>
  renderToStaticMarkup(createElement(ScanFields, { fields, tone }));

describe('ScanFields — the three levels of §4.4', () => {
  it('ticks a sure field « Lu » and shows its value plainly', () => {
    const html = render([{ label: 'Suivi', value: '1Z E63' }]);
    expect(html).toContain('aria-label="Lu"');
    expect(html).toContain('1Z E63');
  });

  it('names a doubtful field « À vérifier », never by its colour alone', () => {
    const html = render([
      { label: 'Destinataire', value: 'Camille Morel ?', status: 'warning' },
    ]);
    expect(html).toContain('aria-label="À vérifier"');
    expect(html).toContain('Camille Morel ?');
  });

  it('leaves a field below « à vérifier » empty, its suggestions in chips', () => {
    const html = render([
      {
        label: 'Destinataire',
        value: 'ignored',
        status: 'error',
        suggestions: [{ label: 'Léa Fontaine' }, { label: 'Lise Fontan' }],
      },
    ]);
    expect(html).toContain('aria-label="Non lu"');
    expect(html).not.toContain('ignored');
    expect(html).toContain('Léa Fontaine');
    expect(html).toContain('Lise Fontan');
    expect(html).not.toContain('<button');
  });

  it('makes the chips buttons when the agent can pick one', () => {
    const html = render(
      [
        {
          label: 'Suivi',
          value: '',
          status: 'error',
          suggestions: [
            {
              label: '1Z E63',
              onPick: () => undefined,
              pickLabel: 'Choisir 1Z E63',
            },
          ],
        },
      ],
      'light',
    );
    expect(html).toContain('<button type="button" aria-label="Choisir 1Z E63"');
  });
});
