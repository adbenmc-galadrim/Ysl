import {
  DEFAULT_TEMPLATES,
  type DefaultTemplateType,
  type NotificationType,
  type TemplateText,
} from '@repo/contract/mail';
import { newId } from '@repo/shared/id';
import { commitLocal } from '#/features/db/commit';
import type {
  CourrierDatabase,
  LocalEmailTemplate,
} from '#/features/db/schema';

/**
 * A template as the screens show it. The default one exists before anyone
 * saves it (`stored: false`): it is written the first time it changes.
 */
export type EmailTemplateView = TemplateText & {
  id: string;
  type: NotificationType;
  isDefault: boolean;
  stored: boolean;
};

export type TemplateOptions = { userId: string; now?: Date };

export class DefaultTemplateError extends Error {
  constructor(id: string) {
    super(`Template ${id} is the default one: restore it, never delete it`);
    this.name = 'DefaultTemplateError';
  }
}

/**
 * The id of an agent's default template, the same on every iPhone: two
 * iPhones that each save it write the same row, never a second default
 * (`email_template_default_idx`). Shaped as a UUID v7, as every id is.
 */
export async function defaultTemplateId(
  ownerId: string,
  type: NotificationType,
): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(`email_template:default:${ownerId}:${type}`),
    ),
  ).slice(0, 16);
  digest[6] = (digest[6]! & 0x0f) | 0x70;
  digest[8] = (digest[8]! & 0x3f) | 0x80;
  const hex = [...digest].map((byte) => byte.toString(16).padStart(2, '0'));
  return [
    hex.slice(0, 4),
    hex.slice(4, 6),
    hex.slice(6, 8),
    hex.slice(8, 10),
    hex.slice(10, 16),
  ]
    .map((part) => part.join(''))
    .join('-');
}

const view = (row: LocalEmailTemplate): EmailTemplateView => ({
  id: row.id,
  type: row.type,
  name: row.name,
  subject: row.subject,
  body: row.body,
  isDefault: row.isDefault,
  stored: true,
});

async function presets(ownerId: string): Promise<EmailTemplateView[]> {
  const types = Object.keys(DEFAULT_TEMPLATES) as DefaultTemplateType[];
  return Promise.all(
    types.map(async (type) => ({
      id: await defaultTemplateId(ownerId, type),
      type,
      ...DEFAULT_TEMPLATES[type],
      isDefault: true,
      stored: false,
    })),
  );
}

/**
 * The agent's templates, the default one first, then by name. Templates
 * belong to whoever wrote them (D2): a colleague's, pulled with the rest of
 * the mailroom, are not shown.
 */
export async function listTemplates(
  db: CourrierDatabase,
  ownerId: string,
): Promise<EmailTemplateView[]> {
  const rows = (await db.emailTemplate.toArray()).filter(
    (row) => row.ownerId === ownerId && !row.deletedAt,
  );
  const stored = rows.map(view);
  const missing = (await presets(ownerId)).filter(
    (preset) =>
      !stored.some((row) => row.isDefault && row.type === preset.type),
  );
  return [...missing, ...stored].sort(
    (a, b) =>
      Number(b.isDefault) - Number(a.isDefault) ||
      a.name.localeCompare(b.name, 'fr'),
  );
}

export async function getTemplate(
  db: CourrierDatabase,
  ownerId: string,
  id: string,
): Promise<EmailTemplateView | undefined> {
  return (await listTemplates(db, ownerId)).find((row) => row.id === id);
}

/** The template a mail of `type` starts from: the agent's default one. */
export async function defaultTemplate(
  db: CourrierDatabase,
  ownerId: string,
  type: DefaultTemplateType = 'avis',
): Promise<EmailTemplateView> {
  const templates = await listTemplates(db, ownerId);
  const found = templates.find((row) => row.isDefault && row.type === type);
  if (!found) throw new Error(`No default ${type} template`);
  return found;
}

async function write(
  db: CourrierDatabase,
  template: EmailTemplateView,
  { userId, now = new Date() }: TemplateOptions,
): Promise<EmailTemplateView> {
  const existing = template.stored
    ? await db.emailTemplate.get(template.id)
    : undefined;
  const row: LocalEmailTemplate = {
    ...(existing ?? { createdAt: now, deletedAt: null }),
    id: template.id,
    type: template.type,
    name: template.name,
    subject: template.subject,
    body: template.body,
    isDefault: template.isDefault,
    ownerId: userId,
    updatedAt: now,
  };
  await commitLocal(
    db,
    { upserts: [{ entity: 'email_template', row }] },
    { now },
  );
  return view(row);
}

/** Saves what the editor holds; the default one is written the first time. */
export async function saveTemplate(
  db: CourrierDatabase,
  template: EmailTemplateView,
  text: TemplateText,
  options: TemplateOptions,
): Promise<EmailTemplateView> {
  return write(db, { ...template, ...text }, options);
}

/** A new template, empty but for its name. */
export async function createTemplate(
  db: CourrierDatabase,
  name: string,
  options: TemplateOptions,
): Promise<EmailTemplateView> {
  return write(
    db,
    {
      id: newId(),
      type: 'avis',
      name,
      subject: '',
      body: '',
      isDefault: false,
      stored: false,
    },
    options,
  );
}

/** A copy to change at will; the copy of the default one is not a default. */
export async function duplicateTemplate(
  db: CourrierDatabase,
  template: EmailTemplateView,
  name: string,
  options: TemplateOptions,
): Promise<EmailTemplateView> {
  return write(
    db,
    { ...template, id: newId(), name, isDefault: false, stored: false },
    options,
  );
}

/** Back to the text the app ships with; nothing else of the agent's changes. */
export async function restoreDefault(
  db: CourrierDatabase,
  template: EmailTemplateView,
  options: TemplateOptions,
): Promise<EmailTemplateView> {
  if (!template.isDefault) return template;
  const preset = DEFAULT_TEMPLATES[template.type as DefaultTemplateType];
  return write(db, { ...template, ...preset }, options);
}

export async function deleteTemplate(
  db: CourrierDatabase,
  template: EmailTemplateView,
  { now = new Date() }: { now?: Date } = {},
): Promise<void> {
  if (template.isDefault) throw new DefaultTemplateError(template.id);
  await commitLocal(
    db,
    { deletes: [{ entity: 'email_template', id: template.id }] },
    { now },
  );
}

/** Whether the default template still reads as the app ships it. */
export function isPreset(template: EmailTemplateView): boolean {
  const preset = DEFAULT_TEMPLATES[template.type as DefaultTemplateType];
  return (
    !!preset &&
    template.isDefault &&
    template.subject === preset.subject &&
    template.body === preset.body &&
    template.name === preset.name
  );
}
