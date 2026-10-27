import {
  MAIL_BODY_TESTED_MAX,
  MAIL_VARIABLES,
  type MailVariable,
  type RenderedMail,
} from '@repo/contract/mail';
import type { TranslateFn } from '@repo/shared/i18n';
import type { TemplateWarning } from '@repo/ui';

const bare = (name: string) =>
  name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[-_\s]/g, '');

/** The variable a typo most likely meant: `{prenom}` for `{prénom}`. */
export function closestVariable(name: string): MailVariable | undefined {
  return MAIL_VARIABLES.find((variable) => bare(variable) === bare(name));
}

const PICKUP: readonly MailVariable[] = ['lieu', 'horaires'];

/**
 * What the agent should know before the mail leaves: names outside the
 * list, the pickup not set in Réglages, a body longer than S5 tried.
 */
export function templateWarnings(
  rendered: RenderedMail,
  t: TranslateFn,
): TemplateWarning[] {
  const warnings: TemplateWarning[] = [];
  if (rendered.unknown.length) {
    const names = rendered.unknown.map((name) => `{${name}}`).join(', ');
    const [only] = rendered.unknown;
    const meant =
      rendered.unknown.length === 1 && only ? closestVariable(only) : undefined;
    warnings.push({
      title: t(
        rendered.unknown.length === 1
          ? 'mail.template.unknown'
          : 'mail.template.unknownMany',
        { names },
      ),
      description: meant
        ? t('mail.template.unknown.suggest', { name: `{${meant}}` })
        : t('mail.template.unknown.description'),
    });
  }
  if (rendered.missing.some((name) => PICKUP.includes(name))) {
    warnings.push({
      title: t('mail.template.pickupMissing'),
      description: t('mail.template.pickupMissing.description'),
    });
  }
  if (rendered.body.length > MAIL_BODY_TESTED_MAX) {
    warnings.push({
      title: t('mail.template.tooLong'),
      description: t('mail.template.tooLong.description', {
        max: MAIL_BODY_TESTED_MAX.toLocaleString('fr-FR'),
      }),
    });
  }
  return warnings;
}
