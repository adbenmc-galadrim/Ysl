import { buildUrl } from '#/compose/urls';

export type TemplateFields = {
  prénom: string;
  nom: string;
  code: string;
  colis: string;
  lieu: string;
  horaires: string;
  agent: string;
};

export const VARIABLES = [
  'prénom',
  'nom',
  'code',
  'colis',
  'lieu',
  'horaires',
  'agent',
  'lien_pas_moi',
  'lien_collegue',
] as const;

export type Rendered = { text: string; unknown: string[] };

const PLACEHOLDER = /\{([\p{L}\p{N}_-]+)\}/gu;

export function render(
  text: string,
  values: Readonly<Record<string, string>>,
): Rendered {
  const unknown = new Set<string>();
  const rendered = text.replace(PLACEHOLDER, (match, name: string) => {
    const value = values[name];
    if (value === undefined) {
      unknown.add(name);
      return match;
    }
    return value;
  });
  return { text: rendered, unknown: [...unknown] };
}

export function parcelList(lines: string): string {
  return lines
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `• ${line}`)
    .join('\n');
}

export const REPLY_NOT_MINE = {
  subject: 'Ce n’est pas à moi',
  body: 'Bonjour,\n\nCe colis ne m’est pas destiné.\n\nMerci',
};

export const REPLY_COLLEAGUE = {
  subject: 'Un collègue passera',
  body: 'Bonjour,\n\nUn collègue viendra retirer le colis à ma place :\n\nMerci',
};

export function replyLink(
  replyTo: string,
  reply: { subject: string; body: string },
  code: string,
): string {
  return buildUrl('mailto', {
    to: replyTo,
    cc: '',
    bcc: '',
    subject: `${reply.subject} · code ${code}`,
    body: reply.body,
  });
}

export function templateValues(
  fields: TemplateFields,
  replyTo: string,
): Record<string, string> {
  return {
    ...fields,
    colis: parcelList(fields.colis),
    lien_pas_moi: replyLink(replyTo, REPLY_NOT_MINE, fields.code),
    lien_collegue: replyLink(replyTo, REPLY_COLLEAGUE, fields.code),
  };
}
