import type { ReactNode } from 'react';

import {
  GroupedRow,
  GroupedSection,
  SettingsIcon,
  type SettingsIconProps,
} from '#components/grouped-list';
import { NavBar } from '#components/nav-bar';
import { Screen } from '#components/screen';
import { Switch } from '#components/switch';
import { cn } from '#lib/tv';

export type SettingsScreenProps = {
  title: string;
  /** Right side of the bar: "OK", "Importer". */
  trailing?: ReactNode;
  onBack?: () => void;
  /** `fill` for grouped cards, `white` for a plain list (the directory). */
  tone?: 'fill' | 'white';
  children: ReactNode;
  className?: string;
};

/**
 * The frame of every settings screen: the title centred in the bar — the
 * client asked for that over a large title, so the first card starts right
 * under it — and a column of grouped sections 20 px apart.
 */
export function SettingsScreen({
  title,
  trailing,
  onBack,
  tone = 'fill',
  children,
  className,
}: SettingsScreenProps) {
  return (
    <Screen
      tone={tone}
      bottomInset={0}
      className="pb-[calc(var(--safe-bottom)+24px)]"
    >
      <NavBar title={title} trailing={trailing} onBack={onBack} />
      <div className={cn('mt-3 flex flex-col gap-5', className)}>
        {children}
      </div>
    </Screen>
  );
}

/** One setting, as data: the Réglages screens are lists of these. */
export type SettingsItem = {
  /** Tells two rows with the same label apart; the label otherwise. */
  key?: string;
  label: string;
  icon?: SettingsIconProps['icon'];
  color?: SettingsIconProps['color'];
  value?: string;
  /** Opens a screen; `false` for a read-only line such as the version. */
  chevron?: boolean;
  /** A toggle instead of a value. */
  toggle?: boolean;
  onToggle?: (checked: boolean) => void;
  /** Opens the screen; without it the row is static. */
  onPress?: () => void;
};

export type SettingsGroup = {
  header?: string;
  footer?: ReactNode;
  items: SettingsItem[];
};

export function SettingsGroupView({ header, footer, items }: SettingsGroup) {
  return (
    <GroupedSection header={header} footer={footer}>
      {items.map((item) => (
        <GroupedRow
          key={item.key ?? item.label}
          leading={
            item.icon && <SettingsIcon icon={item.icon} color={item.color} />
          }
          title={item.label}
          value={item.value}
          onClick={item.onPress}
          accessory={
            item.toggle !== undefined ? (
              <Switch
                checked={item.toggle}
                onCheckedChange={item.onToggle}
                label={item.label}
              />
            ) : item.chevron === false ? undefined : (
              'chevron'
            )
          }
        />
      ))}
    </GroupedSection>
  );
}
