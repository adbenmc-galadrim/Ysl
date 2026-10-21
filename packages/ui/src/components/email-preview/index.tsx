import type { ReactNode } from 'react';

import { IconTile } from '#components/icon-tile';
import { Icon } from '#icons';
import { cn } from '#lib/tv';

export type EmailPreviewProps = {
  subject: ReactNode;
  sender: ReactNode;
  /** The line under the sender: "À : Nora Haddad, aujourd’hui 10:58". */
  meta?: ReactNode;
  /** Defaults to the mailroom's black package mark. */
  avatar?: ReactNode;
  /** The mail client's back link, e.g. "Boîte de réception". */
  backLabel?: ReactNode;
  onBack?: () => void;
  children: ReactNode;
  className?: string;
};

/**
 * An e-mail as the employee reads it in iOS Mail. It documents the template
 * the app sends, inside the chrome it lands in, so wording and order can be
 * judged where they will really be read.
 */
export function EmailPreview({
  subject,
  sender,
  meta,
  avatar,
  backLabel = 'Boîte de réception',
  onBack,
  children,
  className,
}: EmailPreviewProps) {
  return (
    <article className={cn('flex flex-col text-ink', className)}>
      <div className="flex h-10 items-center">
        <button
          type="button"
          onClick={onBack}
          className="-ml-px flex cursor-pointer items-center gap-[3px] text-17 text-blue outline-none focus-visible:ring-2 focus-visible:ring-blue"
        >
          <Icon name="back" size={22} strokeWidth={2.2} />
          {backLabel}
        </button>
      </div>
      <h1 className="mt-2 text-22 font-bold">{subject}</h1>
      <div className="mt-3.5 flex items-start gap-3">
        {avatar ?? <IconTile icon="package" tone="ink" />}
        <div className="flex min-w-0 flex-col gap-[3px]">
          <span className="truncate text-15 font-semibold">{sender}</span>
          {meta && <span className="truncate text-13 text-muted">{meta}</span>}
        </div>
      </div>
      <hr className="mt-4 border-separator" />
      <div className="mt-[15px] flex flex-col">{children}</div>
    </article>
  );
}
