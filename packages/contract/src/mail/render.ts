import { PICKUP_DAYS, type PickupSetting } from '../settings';
import { buildMailUrl } from './urls';

/**
 * The closed list of what a template may quote (S5), shown under the editor.
 * Anything else between braces stays as typed and is pointed out.
 */
export const MAIL_VARIABLES = [
  'prénom',
  'nom',
  'code',
  'colis',
  'lieu',
  'horaires',
  'consignes',
  'reserve',
  'agent',
  'lien_pas_moi',
  'lien_collegue',
] as const;

export type MailVariable = (typeof MAIL_VARIABLES)[number];

/** A value per variable; a variable without one stays visible in the text. */
export type MailValues = Partial<Record<MailVariable, string>>;

/**
 * `unknown`: names outside the list; `missing`: known names with nothing to
 * put in. Both stay in the text as typed, so a mail never leaves with a
 * silent hole.
 */
export type RenderedText = {
  text: string;
  unknown: string[];
  missing: MailVariable[];
};

const PLACEHOLDER = /\{([\p{L}\p{N}_-]+)\}/gu;

export function isMailVariable(name: string): name is MailVariable {
  return (MAIL_VARIABLES as readonly string[]).includes(name);
}

const ALONE = /^\s*\{([\p{L}\p{N}_-]+)\}\s*$/u;

/** A line that holds only a variable left empty on purpose (no instructions) goes. */
function dropsLine(line: string, values: MailValues): boolean {
  const name = ALONE.exec(line)?.[1];
  return name !== undefined && isMailVariable(name) && values[name] === '';
}

/** One pass: a value that holds braces is never read again. */
export function renderText(text: string, values: MailValues): RenderedText {
  const unknown = new Set<string>();
  const missing = new Set<MailVariable>();
  const kept = text
    .split(/\r?\n/)
    .filter((line) => !dropsLine(line, values))
    .join('\n');
  const rendered = kept.replace(PLACEHOLDER, (match, name: string) => {
    if (!isMailVariable(name)) {
      unknown.add(name);
      return match;
    }
    const value = values[name];
    if (value === undefined) {
      missing.add(name);
      return match;
    }
    return value;
  });
  return { text: rendered, unknown: [...unknown], missing: [...missing] };
}

export type RenderedMail = {
  subject: string;
  body: string;
  unknown: string[];
  missing: MailVariable[];
};

const union = <T>(a: readonly T[], b: readonly T[]) => [
  ...new Set([...a, ...b]),
];

export function renderMail(
  template: { subject: string; body: string },
  values: MailValues,
): RenderedMail {
  const subject = renderText(template.subject, values);
  const body = renderText(template.body, values);
  return {
    subject: subject.text,
    body: body.text,
    unknown: union(subject.unknown, body.unknown),
    missing: union(subject.missing, body.missing),
  };
}

/** `{colis}`: one bullet per parcel, never laid out with spaces (Mail drops them, S5). */
export function parcelBullets(lines: readonly string[]): string {
  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `• ${line}`)
    .join('\n');
}

const DAY_SHORT = {
  mon: 'Lun.',
  tue: 'Mar.',
  wed: 'Mer.',
  thu: 'Jeu.',
  fri: 'Ven.',
} as const;

const lower = (label: string) => label.toLowerCase();

/**
 * "Lun. au ven. : 9 h à 12 h 30" — days in a row with the same hours share
 * a line, a closed day is left out; empty when every day is.
 */
export function formatPickupHours(hours: PickupSetting['hours']): string {
  const runs: { from: number; to: number; hours: string }[] = [];
  PICKUP_DAYS.forEach((day, index) => {
    const value = hours[day].trim();
    if (!value) return;
    const last = runs.at(-1);
    if (last && last.to === index - 1 && last.hours === value) last.to = index;
    else runs.push({ from: index, to: index, hours: value });
  });
  return runs
    .map(({ from, to, hours: value }) => {
      const first = DAY_SHORT[PICKUP_DAYS[from]!];
      const days =
        from === to
          ? first
          : `${first} ${to === from + 1 ? 'et' : 'au'} ${lower(DAY_SHORT[PICKUP_DAYS[to]!])}`;
      return `${days} : ${value}`;
    })
    .join('\n');
}

const orNothing = (value: string | null | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

/**
 * `{lieu}`, `{horaires}`, `{consignes}`: what Réglages › Lieu et horaires says
 * (D13). No place or no hours is a gap to point out; no instructions is fine.
 */
export function pickupValues(pickup: PickupSetting): MailValues {
  return {
    lieu: orNothing(pickup.place),
    horaires: orNothing(formatPickupHours(pickup.hours)),
    consignes: pickup.instructions.trim(),
  };
}

export const REPLY_NOT_MINE = {
  subject: 'Ce n’est pas à moi',
  body: 'Bonjour,\n\nCe colis ne m’est pas destiné.\n\nMerci',
};

export const REPLY_COLLEAGUE = {
  subject: 'Un collègue passera',
  body: 'Bonjour,\n\nUn collègue viendra retirer le colis à ma place :\n\nMerci',
};

/** A `mailto:` back to the agent; readable in no mail app as text (S5), offered for who wants it. */
export function replyLink(
  replyTo: string,
  reply: { subject: string; body: string },
  code?: string,
): string {
  return buildMailUrl('mailto', {
    to: [replyTo],
    subject: code ? `${reply.subject} · code ${code}` : reply.subject,
    body: reply.body,
  });
}

/**
 * A line of `{reserve}` for a parcel the agent asked to warn about
 * (`damageForEmail`, YSL-53): "Arrivé abîmé : UPS ···0622, carton abîmé (coin enfoncé)".
 */
export function damageNotice(
  parcel: string,
  damage: { label: string; note: string | null },
): string {
  const note = damage.note?.trim();
  return `Arrivé abîmé : ${parcel}, ${damage.label.toLowerCase()}${note ? ` (${note})` : ''}`;
}

/** What one recipient's e-mail is made of, as the app knows it. */
export type MailFields = {
  firstName?: string | null;
  lastName?: string | null;
  code?: string | null;
  /** One line per parcel, already worded ("UPS ···4471, reçu à 10 h 15"). */
  parcels: readonly string[];
  /** One `damageNotice` per damaged parcel to warn about; none, the line goes. */
  damages?: readonly string[];
  pickup?: PickupSetting | null;
  /** The name the e-mail is signed with. */
  agent?: string | null;
  /** Where the reply links go: the agent's own address. */
  replyTo?: string | null;
};

export function mailValues(fields: MailFields): MailValues {
  const code = orNothing(fields.code);
  const replyTo = orNothing(fields.replyTo);
  return {
    prénom: orNothing(fields.firstName),
    nom: orNothing(fields.lastName),
    code,
    colis: orNothing(parcelBullets(fields.parcels)),
    reserve: (fields.damages ?? []).join('\n'),
    ...(fields.pickup ? pickupValues(fields.pickup) : {}),
    agent: orNothing(fields.agent),
    lien_pas_moi: replyTo && replyLink(replyTo, REPLY_NOT_MINE, code),
    lien_collegue: replyTo && replyLink(replyTo, REPLY_COLLEAGUE, code),
  };
}
