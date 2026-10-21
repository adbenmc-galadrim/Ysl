import {
  TRANSLATIONS,
  type Locale,
  type Messages,
  type TranslationKey,
} from '#i18n/translations';

type PlaceholderNames<Message extends string> =
  Message extends `${string}{{${infer Name}}}${infer Rest}`
    ? Name | PlaceholderNames<Rest>
    : never;

type ParamsArgs<Key extends TranslationKey> = [
  PlaceholderNames<Messages[Key]>,
] extends [never]
  ? []
  : [params: Record<PlaceholderNames<Messages[Key]>, string | number>];

export type TranslateFn = <Key extends TranslationKey>(
  key: Key,
  ...args: ParamsArgs<Key>
) => string;

type AnyParams = Record<string, string | number>;

const PLACEHOLDER_PATTERN = /\{\{(\w+)\}\}/g;

function interpolate(message: string, params: AnyParams | undefined): string {
  if (!params) return message;

  return message.replace(PLACEHOLDER_PATTERN, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

export function createTranslator(locale: Locale): TranslateFn {
  return (key, ...args) =>
    interpolate(TRANSLATIONS[locale][key], (args as [AnyParams?])[0]);
}
