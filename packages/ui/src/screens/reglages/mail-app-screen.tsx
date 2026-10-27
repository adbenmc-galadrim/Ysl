import type { MouseEventHandler } from 'react';

import { Banner } from '#components/banner';
import { buttonVariants } from '#components/button';
import { GroupedRow, GroupedSection } from '#components/grouped-list';
import { Icon } from '#icons';
import { SettingsScreen } from '#screens/reglages/settings-screen';

export type MailAppOption = {
  value: string;
  title: string;
  subtitle?: string;
};

export type MailAppTest = {
  tone: 'green' | 'orange';
  title: string;
  description?: string;
};

export type MailAppScreenProps = {
  options: MailAppOption[];
  value: string;
  onChange?: (value: string) => void;
  footer?: string;
  /** An empty draft in the chosen app, on a real `<a href>` for iOS. */
  testHref: string;
  onTest?: MouseEventHandler<HTMLAnchorElement>;
  /** What the last test showed: opened, or not and why. */
  result?: MailAppTest;
  onBack?: () => void;
};

/**
 * Réglages › E-mails › Messagerie: the mail app "Envoyer" opens on this
 * iPhone, and a test that opens it empty. No mockup: the settings screens
 * of #57, ticked like Apparence.
 */
export function MailAppScreen({
  options,
  value,
  onChange,
  footer,
  testHref,
  onTest,
  result,
  onBack,
}: MailAppScreenProps) {
  return (
    <SettingsScreen title="Messagerie" onBack={onBack}>
      <GroupedSection footer={footer}>
        {options.map((option) => (
          <GroupedRow
            key={option.value}
            title={option.title}
            subtitle={option.subtitle}
            onClick={onChange && (() => onChange(option.value))}
            accessory={
              option.value === value ? (
                <Icon
                  name="tick"
                  size={20}
                  strokeWidth={2.4}
                  className="text-blue"
                  aria-label="Choisie"
                />
              ) : undefined
            }
          />
        ))}
      </GroupedSection>
      <a
        href={testHref}
        onClick={onTest}
        className={buttonVariants({
          variant: 'primary',
          size: 'lg',
          block: true,
        })}
      >
        Tester
      </a>
      <div role="status">
        {result && (
          <Banner
            tone={result.tone}
            icon={result.tone === 'green' ? 'tick' : 'alert'}
            title={result.title}
            description={result.description}
          />
        )}
      </div>
    </SettingsScreen>
  );
}
