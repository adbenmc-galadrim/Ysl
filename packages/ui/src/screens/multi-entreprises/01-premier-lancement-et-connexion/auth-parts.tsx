import { useId, type ReactNode } from 'react';

import { Field, FieldInput } from '#components/field';
import { Icon } from '#icons';
import { cn } from '#lib/tv';

export const SAMPLE_PASSWORD = 'motdepasse12';

/** The square that stands for a company: its initials on an ink tile. */
export function LogoTile({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center bg-ink font-bold text-on-ink',
        className,
      )}
    >
      {children}
    </span>
  );
}

/** A password or e-mail field of the phone forms: 48 px, regular weight. */
export function PhoneField({
  label,
  type = 'password',
  value,
  placeholder,
  error = false,
  className,
}: {
  label: string;
  type?: 'email' | 'password';
  value?: string;
  placeholder?: string;
  error?: boolean;
  className?: string;
}) {
  return (
    <Field
      label={<span className="relative -top-px">{label}</span>}
      className={className}
    >
      {(id) => (
        <FieldInput
          id={id}
          type={type}
          defaultValue={value}
          placeholder={placeholder}
          className={cn(
            'h-12 gap-0 rounded-[12px] pr-3.5 pl-3.5 font-normal',
            error &&
              'shadow-[0_0_0_0.75px_var(--color-red),inset_0_0_0_0.75px_var(--color-red)]',
          )}
          trailing={
            type === 'password' && (
              <Icon name="eye" size={20} className="shrink-0 text-muted" />
            )
          }
        />
      )}
    </Field>
  );
}

/** A labelled 36 px field of the computer forms; `focused` draws the ink edge. */
export function DeskField({
  label,
  type = 'password',
  value,
  focused = false,
  className,
}: {
  label: string;
  type?: 'email' | 'password';
  value: string;
  focused?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="relative -top-px block text-13 font-semibold">
        {label}
      </label>
      <div
        className={cn(
          'mt-2 flex h-9 items-center rounded-[6px] pr-3.5 pl-3',
          focused
            ? 'shadow-[0_0_0_0.75px_var(--color-ink),inset_0_0_0_0.75px_var(--color-ink)]'
            : 'shadow-[0_0_0_0.5px_var(--color-border),inset_0_0_0_0.5px_var(--color-border)]',
        )}
      >
        <input
          id={id}
          type={type}
          defaultValue={value}
          className="h-full min-w-0 flex-1 bg-transparent pb-1 text-14 outline-none"
        />
        {type === 'password' && (
          <Icon name="eye" size={16} className="shrink-0 text-muted" />
        )}
      </div>
    </div>
  );
}

/** The computer sign-in page: brand at the top left, a 400 px form, a footer. */
export function DeskAuthPage({
  logo,
  logoClass,
  brand,
  product,
  footer,
  children,
}: {
  logo: string;
  logoClass?: string;
  brand: string;
  product?: string;
  footer: string;
  children: ReactNode;
}) {
  return (
    <div className="relative h-dvh w-full overflow-hidden bg-surface text-ink">
      <header className="absolute top-7 left-8 flex h-7 items-center">
        <LogoTile className={cn('size-7 rounded-[6px] text-11', logoClass)}>
          {logo}
        </LogoTile>
        <span className="relative -top-0.5 ml-2.5 text-14 font-semibold">{brand}</span>
        {product && <span className="relative -top-0.5 ml-1.5 text-14 text-muted">{product}</span>}
      </header>
      <main className="absolute top-[216px] left-[520px] w-[400px]">
        {children}
      </main>
      <footer className="absolute inset-x-0 top-[852px] border-t border-separator pt-[15px] text-center text-12 text-muted">
        {footer}
      </footer>
    </div>
  );
}
