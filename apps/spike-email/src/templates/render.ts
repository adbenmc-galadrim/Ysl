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

const PLACEHOLDER = /\{([\p{L}_]+)\}/gu;

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

function replyLink(replyTo: string, subject: string, body: string): string {
  return buildUrl('mailto', { to: replyTo, cc: '', bcc: '', subject, body });
}

export function templateValues(
  fields: TemplateFields,
  replyTo: string,
): Record<string, string> {
  return {
    ...fields,
    colis: parcelList(fields.colis),
    lien_pas_moi: replyLink(
      replyTo,
      `Ce n’est pas à moi · code ${fields.code}`,
      'Bonjour,\n\nCe colis ne m’est pas destiné.\n\nMerci',
    ),
    lien_collegue: replyLink(
      replyTo,
      `Un collègue passera · code ${fields.code}`,
      'Bonjour,\n\nUn collègue viendra retirer le colis à ma place :\n\nMerci',
    ),
  };
}
