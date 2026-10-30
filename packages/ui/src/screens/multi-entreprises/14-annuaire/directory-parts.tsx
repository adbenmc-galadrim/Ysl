import type { ReactNode } from 'react';

import { Icon } from '#icons';
import { cn } from '#lib/tv';

export function PhoneDirectoryRow({
  initials,
  name,
  detail,
  trailing,
}: {
  initials: string;
  name: string;
  detail: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="relative h-16">
      <span className="absolute top-3 left-0 flex size-10 items-center justify-center rounded-full bg-fill-2 pb-px text-14 font-semibold">
        {initials}
      </span>
      <p className="absolute top-[11px] left-[52px] text-17 font-semibold">
        {name}
      </p>
      <p className="absolute top-[33px] left-[52px] text-14 text-muted">
        {detail}
      </p>
      {trailing}
      <Icon
        name="chevron"
        size={16}
        className="absolute top-6 right-0 text-faint"
      />
      <div className="absolute inset-x-0 bottom-0 ml-[52px] h-px bg-separator" />
    </div>
  );
}

export function PhoneLetter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <h2 className={cn('h-6 text-20 font-bold', className)}>{children}</h2>;
}

export function PhoneSegments({
  options,
  value,
  label,
  className,
  optionClassName,
}: {
  options: readonly string[];
  value: string;
  label: string;
  className?: string;
  optionClassName?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('grid auto-cols-fr grid-flow-col bg-fill-2 p-0.5', className)}
    >
      {options.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={option === value}
          className={cn(
            'cursor-pointer font-semibold text-ink-2 aria-checked:bg-ink aria-checked:text-on-ink',
            optionClassName,
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

export function PhoneField({
  label,
  value,
  chevron = false,
  labelClassName,
  boxClassName,
}: {
  label: string;
  value: string;
  chevron?: boolean;
  labelClassName?: string;
  boxClassName?: string;
}) {
  return (
    <div>
      <p className={cn('relative -top-px h-4 text-13 font-medium text-muted', labelClassName)}>
        {label}
      </p>
      <div
        className={cn(
          'relative mt-1.5 flex h-12 items-center rounded-[12px] bg-surface pl-3.5 text-17',
          boxClassName,
        )}
      >
        {value}
        {chevron && (
          <Icon
            name="chevron"
            size={20}
            className="absolute top-3.5 right-3.5 rotate-90 text-muted"
          />
        )}
      </div>
    </div>
  );
}

export function DeskPanel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <aside
      className={cn(
        'relative shrink-0 rounded-desk border border-separator bg-surface',
        className,
      )}
    >
      {children}
    </aside>
  );
}

export function DeskPanelField({
  label,
  value,
  invalid = false,
}: {
  label: string;
  value: string;
  invalid?: boolean;
}) {
  return (
    <div>
      <p className="h-4 text-13 font-semibold">{label}</p>
      <div
        className={cn(
          'mt-1 flex h-8 items-center rounded-[6px] pb-[3px] pl-2.5 text-13',
          invalid
            ? 'shadow-[0_0_0_0.5px_var(--color-orange),inset_0_0_0_0.5px_var(--color-orange)]'
            : 'shadow-[0_0_0_0.5px_var(--color-border),inset_0_0_0_0.5px_var(--color-border)]',
        )}
      >
        {value}
      </div>
    </div>
  );
}

export function DeskPanelFacts({
  facts,
  valueLeft,
}: {
  facts: readonly (readonly [string, string])[];
  valueLeft: number;
}) {
  return (
    <dl className="flex flex-col gap-3.5">
      {facts.map(([label, value]) => (
        <div key={label} className="flex h-4 text-13">
          <dt className="text-muted" style={{ width: valueLeft }}>
            {label}
          </dt>
          <dd className="font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
