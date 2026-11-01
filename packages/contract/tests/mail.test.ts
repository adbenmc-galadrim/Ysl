import { describe, expect, it } from 'vitest';
import {
  buildMailUrl,
  canMoveNotification,
  damageNotice,
  DEFAULT_TEMPLATES,
  formatPickupHours,
  mailValues,
  notifyParcel,
  reachedNobody,
  renderMail,
  renderText,
  RELAY_TEMPLATES,
  REPLY_NOT_MINE,
  replyReference,
  replySubject,
  SAMPLE_MAIL,
  SAMPLE_PICKUP_VALUES,
  type MailFields,
  type NotifiableParcel,
  noticeDue,
  noticeRuleOf,
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

  it('drops a line whose variables are all empty, with its words', () => {
    const rendered = renderText(
      'Où : {lieu}\nQuand : {horaires} ({lieu})\nFin',
      {
        lieu: '',
        horaires: '',
      },
    );
    expect(rendered.text).toBe('Fin');
    expect(rendered.empty).toEqual(['lieu', 'horaires']);
  });

  it('leaves no blank line at the edges where a block went', () => {
    const values = { consignes: '', reserve: '' };
    expect(renderText('{consignes}\n\nBonjour', values).text).toBe('Bonjour');
    expect(renderText('Merci\n\n{reserve}', values).text).toBe('Merci');
    expect(renderText('\nMerci\n\n', values).text).toBe('\nMerci\n\n');
  });

  it('keeps a line where one variable has a value', () => {
    expect(
      renderText('{lieu}, {horaires}', { lieu: '', horaires: '9 h' }).text,
    ).toBe(', 9 h');
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
    expect(rendered.subject).toBe(
      '2 colis en attente de retrait – Service Courrier',
    );
    expect(rendered.body).toContain(
      'Où : Hall B\nQuand : Lun. au mer. : 9 h à 18 h\nVen. : 9 h à 12 h\n\nDonnez',
    );
    expect(rendered.body.indexOf('4821')).toBeLessThan(
      rendered.body.indexOf('•'),
    );
    expect(rendered.body.endsWith('\n\nKarim Daoud\nService Courrier')).toBe(
      true,
    );
    expect(`${rendered.subject}${rendered.body}`).not.toMatch(/Saint Laurent/i);
  });

  it('renders the sample of the previews as the stories show it', () => {
    const rendered = renderMail(DEFAULT_TEMPLATES.avis, {
      ...mailValues({ ...SAMPLE_MAIL, agent: 'Karim Daoud' }),
      ...SAMPLE_PICKUP_VALUES,
    });
    expect(rendered.subject).toBe(
      '2 colis en attente de retrait – Service Courrier',
    );
    expect(rendered.body).toBe(
      [
        'Bonjour Nora,',
        '',
        'Votre code de retrait : 4821',
        '',
        'Nous avons reçu pour vous :',
        '• Amazon ···4471, reçu à 10 h 15',
        '• UPS ···0622, de Zalando, 2 pièces sur 3, reçu à 10 h 15',
        '',
        'Où : Rez-de-chaussée, comptoir courrier',
        'Quand : Lun. au ven. : 9 h à 12 h 30 et 14 h à 18 h',
        '',
        'Donnez votre code au comptoir du service courrier.',
        '',
        "Ce n’est pas pour vous ? mailto:karim.daoud@example.com?subject=Ce%20n'est%20pas%20pour%20moi%20-%20Nora%20Haddad",
        'Un collègue viendra le chercher ? mailto:karim.daoud@example.com?subject=Un%20coll%C3%A8gue%20viendra%20le%20chercher%20-%20Nora%20Haddad',
        '',
        'Karim Daoud',
        'Service Courrier',
      ].join('\n'),
    );
  });

  it('renders the mail to a colleague: whose parcels, their code, no quick answers', () => {
    const rendered = renderMail(RELAY_TEMPLATES.avis, {
      ...mailValues({
        firstName: 'Marc Petit',
        code: '4821',
        parcels: ['DHL ···7741, reçu à 10 h 15'],
        agent: 'Karim Daoud',
        replyTo: 'karim.daoud@example.com',
      }),
      ...SAMPLE_PICKUP_VALUES,
    });
    expect(rendered.unknown).toEqual([]);
    expect(rendered.missing).toEqual([]);
    expect(rendered.subject).toBe('Colis pour Marc Petit – Service Courrier');
    expect(rendered.body).toBe(
      [
        'Bonjour,',
        '',
        'Marc Petit n’a pas d’adresse e-mail chez nous : pouvez-vous le lui transmettre ?',
        '',
        'Nous avons reçu pour Marc Petit :',
        '• DHL ···7741, reçu à 10 h 15',
        '',
        'Son code de retrait : 4821',
        '',
        'Où : Rez-de-chaussée, comptoir courrier',
        'Quand : Lun. au ven. : 9 h à 12 h 30 et 14 h à 18 h',
        '',
        'Marc Petit, ou la personne qui vient à sa place, donne ce code au comptoir du service courrier.',
        '',
        'Karim Daoud',
        'Service Courrier',
      ].join('\n'),
    );
    const reminder = renderMail(RELAY_TEMPLATES.relance, {
      ...mailValues({
        firstName: 'Marc Petit',
        code: '4821',
        parcels: ['DHL ···7741'],
      }),
      ...SAMPLE_PICKUP_VALUES,
    });
    expect(reminder.subject).toBe(
      'Rappel pour Marc Petit : colis en attente – Service Courrier',
    );
    expect(reminder.body).toContain('Son code de retrait : 4821');
    expect(reminder.body).not.toContain('mailto:');
  });

  it('renders the reminder: the same code, the parcels and since when, signed neutral', () => {
    const rendered = renderMail(DEFAULT_TEMPLATES.relance, {
      ...mailValues({
        firstName: 'Inès',
        code: '4821',
        parcels: ['FedEx ···3338, reçu le 19 oct.'],
        agent: 'Karim Daoud',
      }),
      ...SAMPLE_PICKUP_VALUES,
    });
    expect(rendered.unknown).toEqual([]);
    expect(rendered.missing).toEqual([]);
    expect(rendered.subject).toBe(
      'Rappel : colis en attente de retrait – Service Courrier',
    );
    expect(rendered.body).toBe(
      [
        'Bonjour Inès,',
        '',
        'Petit rappel : votre code de retrait est 4821.',
        '',
        'Ces colis vous attendent toujours :',
        '• FedEx ···3338, reçu le 19 oct.',
        '',
        'Où : Rez-de-chaussée, comptoir courrier',
        'Quand : Lun. au ven. : 9 h à 12 h 30 et 14 h à 18 h',
        '',
        'Donnez votre code au comptoir du service courrier.',
        '',
        'Karim Daoud',
        'Service Courrier',
      ].join('\n'),
    );
    expect(`${rendered.subject}${rendered.body}`).not.toMatch(/Saint Laurent/i);
  });

  it('names a single parcel without a number in the subject', () => {
    const rendered = renderMail(
      DEFAULT_TEMPLATES.avis,
      mailValues({ parcels: ['UPS ···0622'] }),
    );
    expect(rendered.subject).toBe(
      'Colis en attente de retrait – Service Courrier',
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

  it('leaves out where and when while the mailroom has not set them', () => {
    const values = mailValues({ parcels: ['x'], pickup: EMPTY_PICKUP });
    const rendered = renderMail(DEFAULT_TEMPLATES.avis, values);
    expect(rendered.body).not.toMatch(/Où|Quand|\{lieu\}|\{horaires\}/);
    expect(rendered.body).toContain('• x\n\nDonnez');
    expect(rendered.empty).toEqual(
      expect.arrayContaining(['lieu', 'horaires', 'consignes']),
    );
    expect(rendered.missing).toEqual(
      expect.arrayContaining(['code', 'prénom', 'agent']),
    );
  });

  it('writes the reply links only with an address to answer to', () => {
    const without = renderMail(
      DEFAULT_TEMPLATES.avis,
      mailValues({ parcels: ['x'], agent: 'Karim Daoud' }),
    );
    expect(without.body).not.toMatch(/mailto|pas pour vous|collègue/);
    expect(without.body).toContain('comptoir du service courrier.\n\nKarim');
    expect(without.empty).toEqual(
      expect.arrayContaining(['lien_pas_moi', 'lien_collegue']),
    );
  });

  it('fills in a subject the agent tells apart, spaces as %20', () => {
    const values = mailValues({
      parcels: ['DHL ···7112'],
      replyTo: 'k.daoud@b.fr',
      replyReference: '7112',
      code: '4821',
    });
    expect(values.lien_pas_moi).toBe(
      "mailto:k.daoud@b.fr?subject=Ce%20n'est%20pas%20pour%20moi%20-%207112",
    );
    expect(values.lien_collegue).toBe(
      'mailto:k.daoud@b.fr?subject=Un%20coll%C3%A8gue%20viendra%20le%20chercher%20-%207112',
    );
    expect(decodeURIComponent(values.lien_pas_moi!.split('subject=')[1]!)).toBe(
      "Ce n'est pas pour moi - 7112",
    );
    expect(`${values.lien_pas_moi}${values.lien_collegue}`).not.toMatch(
      /[+&]|body=|4821/,
    );
  });

  it('quotes the end of the number for one parcel, the name for several', () => {
    expect(replyReference({ trackings: ['1Z999AA10123457112'] })).toBe('7112');
    expect(
      replyReference({ trackings: ['A1', 'B2'], name: 'Nora Haddad' }),
    ).toBe('Nora Haddad');
    expect(replyReference({ trackings: [null], name: ' Marc Petit ' })).toBe(
      'Marc Petit',
    );
    expect(replySubject(REPLY_NOT_MINE, undefined)).toBe(
      "Ce n'est pas pour moi",
    );
  });

  it('keeps the reply links as Mail opens them inside the pickup mail', () => {
    const body = renderMail(
      DEFAULT_TEMPLATES.avis,
      mailValues({ parcels: ['x'], replyTo: 'k@b.fr', replyReference: '7112' }),
    ).body;
    const url = buildMailUrl('mailto', { to: ['n@b.fr'], subject: 's', body });
    const carried = decodeURIComponent(url.split('body=')[1]!);
    expect(carried).toContain(
      "Ce n’est pas pour vous ? mailto:k@b.fr?subject=Ce%20n'est%20pas%20pour%20moi%20-%207112",
    );
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

  it('traces the mail of a parcel on tour and leaves it en route (§3.7.9)', () => {
    const onTour = { ...base, status: 'en_route' as const };
    expect(notifyParcel(onTour, options)).toMatchObject({
      reminder: false,
      patch: {
        status: 'en_route',
        statusSeq: 2,
        notifiedAt: null,
        lastNotifiedAt: sentAt,
      },
    });
    expect(
      notifyParcel({ ...onTour, lastNotifiedAt: sentAt }, options),
    ).toMatchObject({ skip: 'closed' });
  });

  it('holds a parcel to settle back: no mail tells it', () => {
    expect(
      notifyParcel({ ...base, status: 'a_regulariser' }, options),
    ).toMatchObject({ skip: 'closed' });
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

describe('reachedNobody', () => {
  const sentAt = new Date('2026-10-20T08:00:00Z');
  const mail = (deliveryStatus: 'bounced' | 'delivered' | null) => ({
    parcelIds: ['p'],
    sentAt,
    deliveryStatus,
  });

  it('holds only when every mail that left bounced', () => {
    expect(reachedNobody('p', [mail('bounced')])).toBe(true);
    expect(reachedNobody('p', [mail('bounced'), mail('delivered')])).toBe(
      false,
    );
    expect(reachedNobody('p', [mail('bounced'), mail(null)])).toBe(false);
    expect(reachedNobody('p', [{ ...mail('bounced'), sentAt: null }])).toBe(
      false,
    );
    expect(reachedNobody('other', [mail('bounced')])).toBe(false);
  });

  it('makes the next mail the notice, not the first reminder', () => {
    const later = new Date('2026-10-22T08:00:00Z');
    const change = notifyParcel(
      {
        id: 'p',
        personId: 'x',
        contactId: null,
        deletedAt: null,
        status: 'notifie',
        statusSeq: 1,
        notifiedAt: sentAt,
        lastNotifiedAt: sentAt,
      } as Parameters<typeof notifyParcel>[0],
      { sentAt: later, agentId: 'a', firstRead: true },
    );
    expect(change).toMatchObject({
      reminder: false,
      patch: { notifiedAt: later, lastNotifiedAt: later },
    });
  });
});

describe('the moment of the first notice (ME29)', () => {
  const smallSite = noticeRuleOf({
    shuttleActsAsDepartment: true,
    emailMoment: 'scan',
  });
  const atScan = noticeRuleOf({
    shuttleActsAsDepartment: false,
    emailMoment: 'scan',
  });
  const atDeposit = noticeRuleOf({
    shuttleActsAsDepartment: false,
    emailMoment: 'deposit',
  });

  it.each([
    ['recu', smallSite, null, true],
    ['recu', atScan, null, false],
    ['recu', atDeposit, null, false],
    ['en_route', atScan, null, true],
    ['en_route', atScan, new Date(), false],
    ['en_route', atDeposit, null, false],
    ['en_route', smallSite, null, false],
    ['depose', atDeposit, null, true],
    ['depose', smallSite, null, true],
    ['notifie', atDeposit, null, false],
    ['a_regulariser', atDeposit, null, false],
  ] as const)('%s, %o, traced %s: %s', (status, rule, lastNotifiedAt, due) => {
    expect(noticeDue({ status, lastNotifiedAt }, rule)).toBe(due);
  });

  it('keeps the old path without a profile, and waits for the deposit on an unreadable moment', () => {
    expect(noticeRuleOf(undefined).tour).toBe(false);
    expect(noticeRuleOf({ shuttleActsAsDepartment: 'oui' }).tour).toBe(false);
    expect(
      noticeRuleOf({ shuttleActsAsDepartment: false, emailMoment: 3 }),
    ).toEqual({
      tour: true,
      atScan: false,
    });
  });

  it('traces a mail that left about a parcel still « Reçu » on tour', () => {
    const sentAt = new Date('2026-11-01T09:00:00Z');
    const change = notifyParcel(
      {
        id: 'p',
        personId: 'x',
        contactId: null,
        deletedAt: null,
        status: 'recu',
        notifiedAt: null,
        lastNotifiedAt: null,
        deliveredAt: null,
        deliveredBy: null,
      },
      { sentAt, agentId: 'a', tour: true },
    );
    expect(change).toMatchObject({
      patch: { status: 'recu', notifiedAt: null, lastNotifiedAt: sentAt },
    });
  });
});
