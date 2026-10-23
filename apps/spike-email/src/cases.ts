import { buildUrl, type Draft } from '#/compose/urls';

export type CaseContext = { replyTo: string };

export type Case = {
  id: string;
  label: string;
  build: (context: CaseContext) => Partial<Draft>;
};

const LINE = ' é è à ç œ « reçu » — c’est prêt.';

export function numberedBody(length: number): string {
  const lines: string[] = [];
  let size = 0;
  for (let index = 1; size < length; index += 1) {
    const line = `Ligne ${String(index).padStart(5, '0')}${LINE}`;
    lines.push(line);
    size += line.length + 1;
  }
  const body = lines.join('\n');
  return `${body.slice(0, length - 4)}\nFIN`;
}

function replyLink(replyTo: string, subject: string): string {
  return buildUrl('mailto', {
    to: replyTo,
    cc: '',
    bcc: '',
    subject,
    body: 'Bonjour,\n\nCe colis ne m’est pas destiné.\n\nMerci',
  });
}

function long(length: number): Case {
  const label = `${length.toLocaleString('fr-FR')} caractères`;
  return {
    id: `long-${length}`,
    label,
    build: () => ({
      subject: `Corps de ${label}`,
      body: numberedBody(length),
    }),
  };
}

export const CASES: readonly Case[] = [
  {
    id: 'accents',
    label: 'Accents et typographie',
    build: () => ({
      subject: 'Élodie, votre colis « fragile » est arrivé — 1 € à régler ?',
      body: [
        'Bonjour Élodie,',
        '',
        'Votre colis est arrivé à l’accueil : présentez le code 4821.',
        'Caractères : é è ê ë à â î ï ô ö ù û ü ç œ æ É È À Ç Œ',
        'Ponctuation : « guillemets » ’apostrophe’ … — – • €',
        'Espace insécable avant les deux-points : ici !',
        'Emoji : 📦 ✅ 👋',
        '',
        'À bientôt,',
        'Service courrier',
      ].join('\n'),
    }),
  },
  {
    id: 'lines',
    label: 'Sauts de ligne et lignes vides',
    build: () => ({
      subject: 'Sauts de ligne',
      body: 'Ligne 1\nLigne 2\n\nAprès une ligne vide\n\n\nAprès deux lignes vides\n    Ligne indentée\nFIN',
    }),
  },
  {
    id: 'reserved',
    label: 'Caractères réservés & = ? # %',
    build: () => ({
      subject: 'Colis A & B = 2 ? #4821 à 100 %',
      body: 'a=1&b=2?c#d%20e\nhttps://exemple.fr/?q=1&r=2#ancre\nFIN',
    }),
  },
  {
    id: 'link',
    label: 'URL longue',
    build: () => ({
      subject: 'Lien vers le suivi',
      body: `Suivre le colis :\nhttps://ysl.shinseo.fr/suivi/?colis=6A12345678901&code=4821&ref=${'x'.repeat(300)}\nFIN`,
    }),
  },
  {
    id: 'recipients',
    label: 'Plusieurs destinataires, Cc et Cci',
    build: ({ replyTo }) => ({
      cc: replyTo,
      bcc: replyTo,
      subject: 'Plusieurs destinataires',
      body: 'Vérifier À (plusieurs adresses), Cc et Cci dans le brouillon.\nFIN',
    }),
  },
  {
    id: 'reply-links',
    label: 'Liens de réponse dans le corps',
    build: ({ replyTo }) => ({
      subject: '2 colis vous attendent au service courrier',
      body: [
        'Bonjour,',
        '',
        'Deux colis sont arrivés pour vous. Code de retrait : 4821.',
        '',
        'Ce n’est pas à moi :',
        replyLink(replyTo, 'Ce n’est pas à moi · code 4821'),
        '',
        'Un collègue passera :',
        replyLink(replyTo, 'Un collègue passera · code 4821'),
        '',
        'Service courrier',
      ].join('\n'),
    }),
  },
  {
    id: 'html',
    label: 'Corps HTML',
    build: () => ({
      subject: 'Corps HTML',
      body: '<p>Bonjour <b>Élodie</b>,</p><p><a href="https://ysl.shinseo.fr">Lien</a></p><img src="https://ysl.shinseo.fr/spike-email/qr-retrait.png" alt="QR">',
    }),
  },
  long(2_000),
  long(8_000),
  long(32_000),
  long(100_000),
];
