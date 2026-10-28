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
  'nombre_colis',
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
 * silent hole. `empty`: known names left empty on purpose, their line gone.
 */
export type RenderedText = {
  text: string;
  unknown: string[];
  missing: MailVariable[];
  empty: MailVariable[];
};

const PLACEHOLDER = /\{([\p{L}\p{N}_-]+)\}/gu;

export function isMailVariable(name: string): name is MailVariable {
  return (MAIL_VARIABLES as readonly string[]).includes(name);
}

/**
 * A line whose every variable is left empty on purpose goes, with the words
 * around them: no "Où :" without a place, no blank line for no instructions.
 */
function emptyVariables(line: string, values: MailValues): MailVariable[] {
  const names = [...line.matchAll(PLACEHOLDER)].map(([, name]) => name!);
  return names.length > 0 &&
    names.every((name) => isMailVariable(name) && values[name] === '')
    ? (names as MailVariable[])
    : [];
}

/** One pass: a value that holds braces is never read again. */
export function renderText(text: string, values: MailValues): RenderedText {
  const unknown = new Set<string>();
  const missing = new Set<MailVariable>();
  const empty = new Set<MailVariable>();
  const lines: string[] = [];
  let dropping = false;
  for (const line of text.split(/\r?\n/)) {
    const dropped = emptyVariables(line, values);
    dropped.forEach((name) => empty.add(name));
    if (dropped.length > 0) {
      dropping = true;
      continue;
    }
    // A block gone whole leaves one blank line between its neighbours, not
    // two, and none at the very start.
    if (dropping && !line.trim() && (!lines.length || !lines.at(-1)!.trim()))
      continue;
    dropping = false;
    lines.push(line);
  }
  if (dropping) while (lines.length && !lines.at(-1)!.trim()) lines.pop();
  const kept = lines.join('\n');
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
  return {
    text: rendered,
    unknown: [...unknown],
    missing: [...missing],
    empty: [...empty],
  };
}

export type RenderedMail = {
  subject: string;
  body: string;
  unknown: string[];
  missing: MailVariable[];
  empty: MailVariable[];
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
    empty: union(subject.empty, body.empty),
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
 * (D13). Left empty there, their line leaves the mail: the agent may write
 * them in the template itself, and the editor points the gap out.
 */
export function pickupValues(pickup: PickupSetting): MailValues {
  return {
    lieu: pickup.place.trim(),
    horaires: formatPickupHours(pickup.hours),
    consignes: pickup.instructions.trim(),
  };
}

/** `{nombre_colis}`, the subject's first words: « Colis », « 2 colis ». */
export function parcelCount(count: number): string | undefined {
  if (count < 1) return undefined;
  return count === 1 ? 'Colis' : `${count} colis`;
}

/**
 * The two quick answers of the pickup e-mail (YSL-70): a `mailto:` back to
 * the agent with only a subject, the agent's inbox telling them apart at a
 * glance. A plain apostrophe and hyphen rather than ’ and –, so the link
 * Mail shows stays readable: little more than `%20` for the spaces.
 */
export const REPLY_NOT_MINE = "Ce n'est pas pour moi";

export const REPLY_COLLEAGUE = 'Un collègue viendra le chercher';

/** « Ce n'est pas pour moi - 7112 »: which parcel, or whose parcels, the answer is about. */
export function replySubject(reply: string, reference?: string | null): string {
  const about = reference?.trim();
  return about ? `${reply} - ${about}` : reply;
}

/** A `mailto:` back to the agent, the subject filled in. */
export function replyLink(
  replyTo: string,
  reply: string,
  reference?: string | null,
): string {
  return buildMailUrl('mailto', {
    to: [replyTo],
    subject: replySubject(reply, reference),
    body: '',
  });
}

/**
 * What a reply's subject quotes: the end of the number of a single parcel,
 * as the desk reads it out; the recipient's name for several, or for a
 * parcel without a number of its own.
 */
export function replyReference({
  trackings,
  name,
}: {
  trackings: readonly (string | null | undefined)[];
  name?: string | null;
}): string | undefined {
  const only = trackings.length === 1 ? trackings[0]?.trim() : undefined;
  return only ? only.slice(-4) : orNothing(name);
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
  /** What the replies' subject quotes (`replyReference`). */
  replyReference?: string | null;
};

export function mailValues(fields: MailFields): MailValues {
  const code = orNothing(fields.code);
  const replyTo = orNothing(fields.replyTo);
  return {
    prénom: orNothing(fields.firstName),
    nom: orNothing(fields.lastName),
    code,
    colis: orNothing(parcelBullets(fields.parcels)),
    nombre_colis: parcelCount(
      fields.parcels.filter((line) => line.trim()).length,
    ),
    reserve: (fields.damages ?? []).join('\n'),
    ...(fields.pickup ? pickupValues(fields.pickup) : {}),
    agent: orNothing(fields.agent),
    // No address to answer to: the lines of the links leave the mail.
    lien_pas_moi: replyTo
      ? replyLink(replyTo, REPLY_NOT_MINE, fields.replyReference)
      : '',
    lien_collegue: replyTo
      ? replyLink(replyTo, REPLY_COLLEAGUE, fields.replyReference)
      : '',
  };
}
