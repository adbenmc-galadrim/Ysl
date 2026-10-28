import {
  DEFAULT_TEMPLATES,
  presetTemplateId,
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
 * A template as the screens show it. The one the app ships (`preset`)
 * exists before anyone saves it (`stored: false`): it is written the first
 * time it changes. `isDefault`: the one every mail starts from, the preset
 * until the agent picks another.
 */
export type EmailTemplateView = TemplateText & {
  id: string;
  type: NotificationType;
  isDefault: boolean;
  preset: boolean;
  stored: boolean;
};

export type TemplateOptions = { userId: string; now?: Date };

export class DefaultTemplateError extends Error {
  constructor(id: string) {
    super(`Template ${id} is the default or the shipped one: never deleted`);
    this.name = 'DefaultTemplateError';
  }
}

const view = (
  row: LocalEmailTemplate,
  presetIds: ReadonlySet<string>,
): EmailTemplateView => ({
  id: row.id,
  type: row.type,
  name: row.name,
  subject: row.subject,
  body: row.body,
  isDefault: row.isDefault,
  preset: presetIds.has(row.id),
  stored: true,
});

async function presets(ownerId: string): Promise<EmailTemplateView[]> {
  const types = Object.keys(DEFAULT_TEMPLATES) as DefaultTemplateType[];
  return Promise.all(
    types.map(async (type) => ({
      id: await presetTemplateId(ownerId, type),
      type,
      ...DEFAULT_TEMPLATES[type],
      isDefault: true,
      preset: true,
      stored: false,
    })),
  );
}

/**
 * The agent's templates, the default one first, then by name. Templates
 * belong to whoever wrote them (D2): a colleague's, pulled before the server
 * kept them back, are not shown. A type left without a default (its default
 * deleted from another iPhone) falls back on the preset.
 */
export async function listTemplates(
  db: CourrierDatabase,
  ownerId: string,
): Promise<EmailTemplateView[]> {
  const shipped = await presets(ownerId);
  const presetIds = new Set(shipped.map(({ id }) => id));
  const rows = (await db.emailTemplate.toArray()).filter(
    (row) => row.ownerId === ownerId && !row.deletedAt,
  );
  const stored = rows.map((row) => view(row, presetIds));
  const hasDefault = (type: NotificationType) =>
    stored.some((row) => row.isDefault && row.type === type);
  const all = [
    ...shipped
      .filter((preset) => !stored.some(({ id }) => id === preset.id))
      .map((preset) => ({ ...preset, isDefault: !hasDefault(preset.type) })),
    ...stored.map((row) =>
      row.preset && !hasDefault(row.type) ? { ...row, isDefault: true } : row,
    ),
  ];
  return all.sort(
    (a, b) =>
      Number(b.isDefault) - Number(a.isDefault) ||
      Number(b.preset) - Number(a.preset) ||
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

async function rowOf(
  db: CourrierDatabase,
  template: EmailTemplateView,
  userId: string,
  now: Date,
): Promise<LocalEmailTemplate> {
  const existing = template.stored
    ? await db.emailTemplate.get(template.id)
    : undefined;
  return {
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
}

/** Rows written in this order, in one commit: the order the server applies them. */
async function write(
  db: CourrierDatabase,
  templates: readonly EmailTemplateView[],
  { userId, now = new Date() }: TemplateOptions,
): Promise<EmailTemplateView[]> {
  const rows = await Promise.all(
    templates.map((template) => rowOf(db, template, userId, now)),
  );
  await commitLocal(
    db,
    { upserts: rows.map((row) => ({ entity: 'email_template', row })) },
    { now },
  );
  return templates.map((template) => ({ ...template, stored: true }));
}

const writeOne = async (
  db: CourrierDatabase,
  template: EmailTemplateView,
  options: TemplateOptions,
) => (await write(db, [template], options))[0]!;

/** Saves what the editor holds; the preset is written the first time. */
export async function saveTemplate(
  db: CourrierDatabase,
  template: EmailTemplateView,
  text: TemplateText,
  options: TemplateOptions,
): Promise<EmailTemplateView> {
  return writeOne(db, { ...template, ...text }, options);
}

/** A new template, empty but for its name. */
export async function createTemplate(
  db: CourrierDatabase,
  name: string,
  options: TemplateOptions,
): Promise<EmailTemplateView> {
  return writeOne(
    db,
    {
      id: newId(),
      type: 'avis',
      name,
      subject: '',
      body: '',
      isDefault: false,
      preset: false,
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
  return writeOne(
    db,
    {
      ...template,
      id: newId(),
      name,
      isDefault: false,
      preset: false,
      stored: false,
    },
    options,
  );
}

/**
 * Makes `template` the one every mail of its type starts from. The former
 * default is written first, no longer default: the server holds one default
 * per agent and type (`email_template_default_idx`). A preset never saved is
 * written then, so it stays in the list to come back to.
 */
export async function setDefaultTemplate(
  db: CourrierDatabase,
  template: EmailTemplateView,
  options: TemplateOptions,
): Promise<EmailTemplateView> {
  if (template.isDefault) return template;
  const former = (await listTemplates(db, options.userId)).filter(
    (row) => row.isDefault && row.type === template.type,
  );
  const written = await write(
    db,
    [
      ...former.map((row) => ({ ...row, isDefault: false })),
      { ...template, isDefault: true },
    ],
    options,
  );
  return written.at(-1)!;
}

/** Back to the text the app ships with; nothing else of the agent's changes. */
export async function restoreDefault(
  db: CourrierDatabase,
  template: EmailTemplateView,
  options: TemplateOptions,
): Promise<EmailTemplateView> {
  if (!template.preset) return template;
  const preset = DEFAULT_TEMPLATES[template.type as DefaultTemplateType];
  return writeOne(db, { ...template, ...preset }, options);
}

/** Any template but the default one and the preset, which the server keeps. */
export function canDelete(template: EmailTemplateView): boolean {
  return !template.isDefault && !template.preset;
}

export async function deleteTemplate(
  db: CourrierDatabase,
  template: EmailTemplateView,
  { now = new Date() }: { now?: Date } = {},
): Promise<void> {
  if (!canDelete(template)) throw new DefaultTemplateError(template.id);
  await commitLocal(
    db,
    { deletes: [{ entity: 'email_template', id: template.id }] },
    { now },
  );
}

/** Whether the preset still reads as the app ships it. */
export function isPreset(template: EmailTemplateView): boolean {
  const preset = DEFAULT_TEMPLATES[template.type as DefaultTemplateType];
  return (
    !!preset &&
    template.preset &&
    template.subject === preset.subject &&
    template.body === preset.body &&
    template.name === preset.name
  );
}
