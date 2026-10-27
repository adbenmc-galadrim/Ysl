import { describe, expect, it } from 'vitest';
import {
  buildMailUrl,
  canMoveNotification,
  damageNotice,
  DEFAULT_TEMPLATES,
  formatPickupHours,
  mailValues,
  notifyParcel,
  renderMail,
  renderText,
  type MailFields,
  type NotifiableParcel,
} from '@repo/contract/mail';
import { readParcelEvent, eventColumns } from '@repo/contract/parcel-event';
import { EMPTY_PICKUP } from '@repo/contract/settings';

describe('mail links', () => {
  const message = {
    to: ['nora.haddad@example.com', 'Ines <ines@example.com>'],
    cc: ['chef@example.com'],
    subject: 'Colis & code = 4821 ?',
    body: 'Bonjour Nora,\nVoici « vos » colis…\n\nMerci',
  };

  it('encodes spaces as %20 and line breaks as %0D%0A, never as +', () => {
    const url = buildMailUrl('mailto', message);
    expect(url).not.toContain('+');
    expect(url).toContain('Bonjour%20Nora%2C%0D%0AVoici');
    expect(url).toContain('%0D%0A%0D%0AMerci');
  });

  it('keeps @ readable in addresses and escapes the reserved characters', () => {
    const url = buildMailUrl('mailto', message);
    expect(
      url.startsWith(
        'mailto:nora.haddad@example.com,Ines%20%3Cines@example.com%3E?cc=chef@example.com&subject=',
      ),
    ).toBe(true);
    expect(url).toContain('subject=Colis%20%26%20code%20%3D%204821%20%3F');
  });

  it('leaves out the empty parameters', () => {
    expect(
      buildMailUrl('mailto', { to: ['a@b.fr'], subject: '', body: 'x' }),
    ).toBe('mailto:a@b.fr?body=x');
  });

  it('opens Outlook and Gmail by their own schemes, the recipients as a parameter', () => {
    const one = { to: ['a@b.fr'], subject: 'S', body: 'B' };
    expect(buildMailUrl('outlook', one)).toBe(
      'ms-outlook://compose?to=a@b.fr&subject=S&body=B',
    );
    expect(buildMailUrl('gmail', one)).toBe(
      'googlegmail:///co?to=a@b.fr&subject=S&body=B',
    );
  });
});

describe('template rendering', () => {
  it('never reads a value again: no substitution in cascade', () => {
    const rendered = renderText('{prénom} {nom}', {
      prénom: '{nom}',
      nom: 'Haddad',
    });
    expect(rendered.text).toBe('{nom} Haddad');
  });

  it('leaves an unknown variable as typed and names it', () => {
    const rendered = renderText('Bonjour {prenom}, {xyz}', { prénom: 'Nora' });
    expect(rendered.text).toBe('Bonjour {prenom}, {xyz}');
    expect(rendered.unknown).toEqual(['prenom', 'xyz']);
  });

  it('leaves a known variable without a value visible, as missing', () => {
    const rendered = renderMail(
      { subject: 'Code {code}', body: 'Votre code : {code}' },
      {},
    );
    expect(rendered.body).toBe('Votre code : {code}');
    expect(rendered.missing).toEqual(['code']);
  });

  it('drops the line of an optional value left empty, not a gap in a sentence', () => {
    expect(
      renderText('Où : {lieu}\n{consignes}\nFin', {
        lieu: 'Hall',
        consignes: '',
      }).text,
    ).toBe('Où : Hall\nFin');
  });

  it('renders the default template from what the app knows, parcels as bullets', () => {
    const values = mailValues({
      firstName: 'Nora',
      code: '4821',
      parcels: ['Amazon ···4471, reçu à 10 h 15', 'UPS ···0622, reçu à 11 h'],
      pickup: {
        place: 'Hall B',
        hours: {
          mon: '9 h à 18 h',
          tue: '9 h à 18 h',
          wed: '9 h à 18 h',
          thu: '',
          fri: '9 h à 12 h',
        },
        instructions: '',
      },
      agent: 'Karim Daoud',
    });
    const rendered = renderMail(DEFAULT_TEMPLATES.avis, values);
    expect(rendered.unknown).toEqual([]);
    expect(rendered.missing).toEqual([]);
    expect(rendered.body).toContain('Votre code de retrait : 4821');
    expect(rendered.body).toContain(
      '• Amazon ···4471, reçu à 10 h 15\n• UPS ···0622, reçu à 11 h',
    );
    expect(rendered.body).toContain(
      'Quand :\nLun. au mer. : 9 h à 18 h\nVen. : 9 h à 12 h\n\nCe colis',
    );
    expect(rendered.body.indexOf('4821')).toBeLessThan(
      rendered.body.indexOf('•'),
    );
  });

  it('warns about a damaged parcel under the list, and says nothing otherwise', () => {
    const damages = [
      damageNotice('UPS ···0622', {
        label: 'Carton abîmé',
        note: ' coin enfoncé ',
      }),
    ];
    const body = (fields: Partial<MailFields>) =>
      renderMail(
        DEFAULT_TEMPLATES.avis,
        mailValues({ parcels: ['UPS ···0622'], ...fields }),
      ).body;
    expect(body({ damages })).toContain(
      '• UPS ···0622\nArrivé abîmé : UPS ···0622, carton abîmé (coin enfoncé)\n\nOù',
    );
    expect(body({})).toContain('• UPS ···0622\n\nOù');
  });

  it('points out a mailroom whose place and hours are not set yet', () => {
    const values = mailValues({ parcels: ['x'], pickup: EMPTY_PICKUP });
    expect(renderMail(DEFAULT_TEMPLATES.avis, values).missing).toEqual(
      expect.arrayContaining(['lieu', 'horaires', 'code', 'prénom', 'agent']),
    );
  });

  it('writes the reply links only with an address to answer to', () => {
    expect(mailValues({ parcels: [] }).lien_pas_moi).toBeUndefined();
    expect(
      mailValues({ parcels: [], replyTo: 'k@b.fr', code: '1' }).lien_pas_moi,
    ).toMatch(/^mailto:k@b\.fr\?subject=Ce%20n/);
  });

  it('joins two days in a row with "et"', () => {
    expect(
      formatPickupHours({
        mon: '9 h',
        tue: '9 h',
        wed: '',
        thu: '10 h',
        fri: '',
      }),
    ).toBe('Lun. et mar. : 9 h\nJeu. : 10 h');
  });
});

describe('notification status', () => {
  it('keeps a sent mail sent', () => {
    expect(canMoveNotification('sent', 'opened')).toBe(false);
    expect(canMoveNotification('sent', 'failed')).toBe(false);
    expect(canMoveNotification('opened', 'sent')).toBe(true);
    expect(canMoveNotification('failed', 'opened')).toBe(true);
  });
});

describe('parcels of a confirmed mail', () => {
  const sentAt = new Date('2026-10-27T10:58:00Z');
  const base: NotifiableParcel = {
    id: '0199f000-0000-7000-8000-000000000001',
    status: 'recu',
    statusSeq: 2,
    notifiedAt: null,
    lastNotifiedAt: null,
    deliveredAt: null,
    deliveredBy: null,
    personId: '0199f000-0000-7000-8000-0000000000aa',
    contactId: null,
    deletedAt: null,
  };
  const options = { sentAt, agentId: 'agent' };

  it('notifies a received parcel, one step up the counter', () => {
    const change = notifyParcel(base, options);
    expect(change).toMatchObject({
      reminder: false,
      patch: {
        status: 'notifie',
        statusSeq: 3,
        notifiedAt: sentAt,
        lastNotifiedAt: null,
      },
    });
  });

  it('records a reminder without moving the first notice', () => {
    const first = new Date('2026-10-25T09:00:00Z');
    const change = notifyParcel(
      { ...base, status: 'notifie', notifiedAt: first },
      options,
    );
    expect(change).toMatchObject({
      reminder: true,
      patch: {
        status: 'notifie',
        statusSeq: 2,
        notifiedAt: first,
        lastNotifiedAt: sentAt,
      },
    });
  });

  it('leaves alone a parcel handed over, deleted, to complete or with nobody on it', () => {
    expect(notifyParcel({ ...base, status: 'remis' }, options)).toMatchObject({
      skip: 'closed',
    });
    expect(notifyParcel({ ...base, deletedAt: sentAt }, options)).toMatchObject(
      { skip: 'closed' },
    );
    expect(
      notifyParcel({ ...base, status: 'a_completer' }, options),
    ).toMatchObject({ skip: 'incomplete' });
    expect(notifyParcel({ ...base, personId: null }, options)).toMatchObject({
      skip: 'no-recipient',
    });
  });

  it('writes and reads back the event of a mail sent', () => {
    const event = {
      type: 'parcel.notified',
      notificationId: 'n1',
      kind: 'relance',
    } as const;
    const { type, detail } = eventColumns(event);
    expect(readParcelEvent(type, detail)).toEqual(event);
  });
});
