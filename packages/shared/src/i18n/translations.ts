import { fr } from '#i18n/locales/fr';

export const LOCALES = ['fr'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'fr';

export type Messages = typeof fr;

export type TranslationKey = keyof Messages;

export type Dictionary = Record<TranslationKey, string>;

export const TRANSLATIONS = {
  fr,
} satisfies Record<Locale, Dictionary>;
