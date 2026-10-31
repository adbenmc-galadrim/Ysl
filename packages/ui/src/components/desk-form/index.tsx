import { useId, type ComponentProps, type ReactNode } from 'react';

import { Icon, type IconName } from '#icons';
import { cn } from '#lib/tv';

/** The 15 px heading of a form section, with its optional grey line. */
export function DeskSectionTitle({
  title,
  description,
  className,
}: {
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <h2 className="text-15 font-semibold">{title}</h2>
      {description && (
        <p className="relative -top-px mt-1 h-4 text-13 text-muted">{description}</p>
      )}
    </div>
  );
}

/** A form line: the label and its hint on the left, the control 280 px further. */
export function DeskFormRow({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start', className)}>
      <div className="w-[280px] shrink-0 pt-[7px]">
        <p className="relative -top-px h-4 text-13 font-semibold">{label}</p>
        {hint && <p className="mt-1 text-12 text-muted">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

/** The 32 px text field of a desktop form; the label is for screen readers. */
export function DeskInput({
  label,
  invalid = false,
  className,
  ...props
}: Omit<ComponentProps<'input'>, 'aria-label'> & {
  label: string;
  invalid?: boolean;
}) {
  return (
    <input
      aria-label={label}
      className={cn(
        'h-8 w-[360px] rounded-[6px] bg-surface px-2.5 pb-[3px] text-13 text-ink outline-none',
        invalid
          ? 'shadow-[0_0_0_0.5px_var(--color-orange),inset_0_0_0_0.5px_var(--color-orange)]'
          : 'shadow-[0_0_0_0.5px_var(--color-border),inset_0_0_0_0.5px_var(--color-border)]',
        'focus-visible:ring-2 focus-visible:ring-blue',
        className,
      )}
      {...props}
    />
  );
}

/** `DeskInput` under a bold label, as the panels beside a table draw it. */
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
      <DeskInput
        label={label}
        defaultValue={value}
        invalid={invalid}
        className="mt-1 block w-full"
      />
    </div>
  );
}

/** A labelled 36 px field; `focused` draws the ink edge. */
export function DeskField({
  label,
  type = 'text',
  value,
  focused = false,
  className,
  labelClassName,
  boxClassName,
  inputClassName,
}: {
  label: string;
  type?: 'text' | 'email' | 'password';
  value: string;
  focused?: boolean;
  className?: string;
  labelClassName?: string;
  boxClassName?: string;
  inputClassName?: string;
}) {
  const id = useId();
  return (
    <div className={className}>
      <label
        htmlFor={id}
        className={cn('relative -top-px block text-13 font-semibold', labelClassName)}
      >
        {label}
      </label>
      <div
        className={cn(
          'mt-2 flex h-9 items-center rounded-[6px] pr-3.5 pl-3',
          focused
            ? 'shadow-[0_0_0_0.75px_var(--color-ink),inset_0_0_0_0.75px_var(--color-ink)]'
            : 'shadow-[0_0_0_0.5px_var(--color-border),inset_0_0_0_0.5px_var(--color-border)]',
          boxClassName,
        )}
      >
        <input
          id={id}
          type={type}
          defaultValue={value}
          className={cn(
            'h-full min-w-0 flex-1 bg-transparent pb-1 text-14 outline-none',
            inputClassName,
          )}
        />
        {type === 'password' && (
          <Icon name="eye" size={16} className="shrink-0 text-muted" />
        )}
      </div>
    </div>
  );
}

/** A filter of the platform's pages: icon, grey name, bold value, chevron. */
export function DeskSelect({
  icon,
  label,
  value,
  className,
}: {
  icon: IconName;
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={cn(
        'flex h-8 shrink-0 cursor-pointer items-center rounded-[6px] border border-border bg-surface pl-[9px] text-13 whitespace-nowrap outline-none',
        'focus-visible:ring-2 focus-visible:ring-blue',
        className,
      )}
    >
      <Icon name={icon} size={14} className="text-muted" />
      <span className="-mt-0.5 ml-1.5 text-muted">{label}</span>
      <span className="-mt-0.5 ml-1.5 font-semibold">{value}</span>
      <Icon
        name="chevron"
        size={10}
        className="mr-[9px] ml-auto rotate-90 text-muted"
      />
    </button>
  );
}

/** Mutually exclusive words in a 28 px grey track, each one 100 px wide. */
export function DeskChoice({
  options,
  value,
}: {
  options: readonly string[];
  value: string;
}) {
  return (
    <div
      role="radiogroup"
      className="flex h-7 shrink-0 rounded-[6px] bg-fill p-0.5"
    >
      {options.map((option) => {
        const on = option === value;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={on}
            className={cn(
              'h-6 w-[100px] cursor-pointer rounded-[4px] pb-1 text-12 outline-none',
              'focus-visible:ring-2 focus-visible:ring-blue',
              on
                ? 'border border-border bg-surface font-semibold text-ink'
                : 'text-ink-2',
            )}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
