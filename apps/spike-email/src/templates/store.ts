import type { KeyValueStore } from '#/journal';
import {
  DEFAULT_TEMPLATE,
  DEFAULT_TEMPLATE_ID,
  type Template,
} from '#/templates/default';

const STORAGE_KEY = 'spike-email:templates';

function isTemplate(value: unknown): value is Template {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return ['id', 'name', 'subject', 'body'].every(
    (key) => typeof candidate[key] === 'string',
  );
}

function readTemplates(store: KeyValueStore): Template[] {
  try {
    const raw = store.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isTemplate) : [];
  } catch {
    return [];
  }
}

export class TemplateStore {
  private items: Template[];

  constructor(
    private readonly store: KeyValueStore,
    private readonly newId: () => string = () => crypto.randomUUID(),
  ) {
    const saved = readTemplates(store);
    this.items = saved.some((item) => item.id === DEFAULT_TEMPLATE_ID)
      ? saved
      : [DEFAULT_TEMPLATE, ...saved];
  }

  list(): readonly Template[] {
    return this.items;
  }

  get(id: string): Template | undefined {
    return this.items.find((item) => item.id === id);
  }

  create(): Template {
    const template = {
      id: this.newId(),
      name: 'Nouveau modèle',
      subject: '',
      body: 'Bonjour {prénom},\n\n\n\n{agent}',
    };
    this.items = [...this.items, template];
    this.save();
    return template;
  }

  duplicate(id: string): Template | undefined {
    const source = this.get(id);
    if (!source) return undefined;
    const copy = {
      ...source,
      id: this.newId(),
      name: `${source.name} (copie)`,
    };
    this.items = [...this.items, copy];
    this.save();
    return copy;
  }

  update(id: string, patch: Partial<Omit<Template, 'id'>>): void {
    this.items = this.items.map((item) =>
      item.id === id ? { ...item, ...patch } : item,
    );
    this.save();
  }

  remove(id: string): boolean {
    if (id === DEFAULT_TEMPLATE_ID) return false;
    this.items = this.items.filter((item) => item.id !== id);
    this.save();
    return true;
  }

  resetDefault(): void {
    this.items = this.items.map((item) =>
      item.id === DEFAULT_TEMPLATE_ID ? DEFAULT_TEMPLATE : item,
    );
    this.save();
  }

  private save(): void {
    try {
      this.store.setItem(STORAGE_KEY, JSON.stringify(this.items));
    } catch {
      return;
    }
  }
}
