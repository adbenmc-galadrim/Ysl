import { describe, expect, it } from 'vitest';
import { buildUrl, type Draft, type Target } from '#/compose/urls';

const empty: Draft = { to: '', cc: '', bcc: '', subject: '', body: '' };

function draft(fields: Partial<Draft>): Draft {
  return { ...empty, ...fields };
}

function params(url: string): Map<string, string> {
  const search = url.slice(url.indexOf('?') + 1);
  return new Map(
    search.split('&').map((pair) => {
      const [name = '', value = ''] = pair.split('=');
      return [name, decodeURIComponent(value)];
    }),
  );
}

describe('buildUrl', () => {
  it('encodes spaces as %20, never as +', () => {
    const url = buildUrl('mailto', draft({ subject: 'Votre colis est là' }));

    expect(url).toBe('mailto:?subject=Votre%20colis%20est%20l%C3%A0');
    expect(url).not.toContain('+');
  });

  it('keeps accents, French punctuation and emoji intact', () => {
    const body = 'Élodie, « reçu » à 9 h — c’est prêt 📦';

    const url = buildUrl('mailto', draft({ body }));

    expect(params(url).get('body')).toBe(body);
  });

  it('does not let reserved characters open a new parameter', () => {
    const subject = 'A & B = C ? #1 100%';

    const url = buildUrl('mailto', draft({ subject, body: 'corps' }));

    expect([...params(url).keys()]).toEqual(['subject', 'body']);
    expect(params(url).get('subject')).toBe(subject);
  });

  it('turns every line break into CRLF', () => {
    const url = buildUrl('mailto', draft({ body: 'a\nb\r\nc' }));

    expect(url).toBe('mailto:?body=a%0D%0Ab%0D%0Ac');
  });

  it('lists several recipients and omits empty copies', () => {
    const url = buildUrl(
      'mailto',
      draft({ to: 'a@exemple.fr, b@exemple.fr', cc: 'c@exemple.fr' }),
    );

    expect(url).toBe('mailto:a@exemple.fr,b@exemple.fr?cc=c@exemple.fr');
  });

  it('carries the same content to every app', () => {
    const fields = draft({
      to: 'a@exemple.fr, b@exemple.fr',
      cc: 'c@exemple.fr',
      bcc: 'd@exemple.fr',
      subject: 'Colis A & B = 2 ?',
      body: 'Élodie\n#4821 à 100 %',
    });
    const expected = {
      cc: 'c@exemple.fr',
      bcc: 'd@exemple.fr',
      subject: 'Colis A & B = 2 ?',
      body: 'Élodie\r\n#4821 à 100 %',
    };

    expect(Object.fromEntries(params(buildUrl('mailto', fields)))).toEqual(
      expected,
    );
    expect(buildUrl('mailto', fields)).toMatch(
      /^mailto:a@exemple\.fr,b@exemple\.fr\?/,
    );
    for (const [target, prefix] of [
      ['outlook', 'ms-outlook://compose?'],
      ['gmail', 'googlegmail:///co?'],
    ] as [Target, string][]) {
      const url = buildUrl(target, fields);
      expect(url.startsWith(prefix)).toBe(true);
      expect(Object.fromEntries(params(url))).toEqual({
        to: 'a@exemple.fr,b@exemple.fr',
        ...expected,
      });
    }
  });

  it('encodes a mailto link nested in the body a second time', () => {
    const reply = buildUrl(
      'mailto',
      draft({ to: 'agent@exemple.fr', subject: 'Pas à moi' }),
    );

    const url = buildUrl('mailto', draft({ body: `Répondre : ${reply}` }));

    expect(url).toContain('%2520');
    expect(params(url).get('body')).toBe(`Répondre : ${reply}`);
  });
});
