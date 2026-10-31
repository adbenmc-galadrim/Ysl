import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import {
  CompanySettingsDesk,
  SettingsScreen,
  type CompanySettingsTab,
} from '@repo/ui';
import { useNavigate } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useDeskShell } from '#/features/shell/components/use-desk-shell';
import { DESK_WIDTH, useMediaQuery } from '#/lib/use-media-query';

const t = createTranslator(DEFAULT_LOCALE);

const TAB_PATH = {
  identity: '/reglages/identite',
  operation: '/reglages/fonctionnement',
  retention: '/reglages/conservation',
} as const;

function DeskFrame({
  tab,
  title,
  overlay,
  children,
}: {
  tab: CompanySettingsTab;
  title: string;
  overlay?: ReactNode;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const { companyCrumb, ...shell } = useDeskShell();
  return (
    <CompanySettingsDesk
      tab={tab}
      navEntry="reglages"
      overlay={overlay}
      onTab={(id) => void navigate({ to: TAB_PATH[id] })}
      shell={{ ...shell, breadcrumb: [companyCrumb, title] }}
    >
      {children}
    </CompanySettingsDesk>
  );
}

/** A page of the company's settings: its tabs on a computer (mockup 16), a settings screen on a phone. */
export function CompanyFrame({
  tab,
  title,
  overlay,
  children,
}: {
  tab: CompanySettingsTab;
  title: string;
  overlay?: ReactNode;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const desk = useMediaQuery(DESK_WIDTH);
  if (desk) {
    return (
      <DeskFrame tab={tab} title={title} overlay={overlay}>
        {children}
      </DeskFrame>
    );
  }
  return (
    <SettingsScreen
      title={title}
      onBack={() => void navigate({ to: '/reglages' })}
    >
      {children}
      {overlay}
    </SettingsScreen>
  );
}

export const companyPlaceholder = (online: boolean, failed: boolean) =>
  !online
    ? t('company.offline')
    : failed
      ? t('company.failed')
      : t('company.loading');
