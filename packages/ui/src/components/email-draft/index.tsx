import type { ReactNode } from 'react';

import { Avatar } from '#components/avatar';
import { Icon } from '#icons';
import { cn } from '#lib/tv';

export type EmailRecipientProps = {
  name: string;
  initials: string;
  email?: string;
  /** In place of the address when there is none: "Adresse manquante", in orange. */
  missing?: string;
  onClick?: () => void;
  className?: string;
};

/**
 * Who the previewed e-mail goes to. It opens the person's record, so a wrong
 * address is fixed before sending rather than after a bounce.
 */
export function EmailRecipient({
  name,
  initials,
  email,
  missing,
  onClick,
  className,
}: EmailRecipientProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-[52px] w-full cursor-pointer items-center gap-2.5 rounded-control bg-surface pr-2.5 pl-3.5 text-left',
        'outline-none focus-visible:ring-2 focus-visible:ring-blue active:bg-fill-2',
        className,
      )}
    >
      <Avatar
        name={name}
        initials={initials}
        tone="ink"
        className="size-8 rounded-tile-sm text-12"
      />
      {/* Penpot centres the two lines 1.5 px above the middle. */}
      <span className="mb-[3px] flex min-w-0 flex-1 flex-col gap-px">
        <span className="truncate text-15 font-semibold">{name}</span>
        {missing ? (
          <span className="truncate text-12 font-semibold text-orange-strong">
            {missing}
          </span>
        ) : (
          <span className="truncate text-12 text-muted">{email}</span>
        )}
      </span>
      <Icon
        name="chevron"
        size={16}
        strokeWidth={2.2}
        className="shrink-0 text-faint"
      />
    </button>
  );
}

/**
 * A stand-in for the pickup QR at thumbnail size: a 3 × 3 grid of offset
 * pairs, which reads as "a code" without pretending to be scannable.
 */
function QrGlyph({ className }: { className?: string }) {
  const cells = [0, 1, 2].flatMap((col) =>
    [0, 1, 2].map((row) => [col, row] as const),
  );
  return (
    <svg
      viewBox="0 0 72 72"
      aria-hidden="true"
      className={cn('size-[72px] shrink-0 rounded-[calc(var(--radius-card)/4)] bg-white', className)}
    >
      {cells.map(([col, row]) => (
        <g key={`${col}-${row}`} transform={`translate(${4 + col * 21.3} ${4 + row * 21.3})`}>
          <rect width="7" height="7" />
          <rect x="7.1" y="14.2" width="7" height="7" />
        </g>
      ))}
    </svg>
  );
}

export type EmailDraftProps = {
  subject: ReactNode;
  /** The greeting paragraph. */
  body: ReactNode;
  /** The 4-digit pickup code, shown next to its QR. */
  code: string;
  /** One line per parcel waiting: "Amazon ···4471, reçu à 10 h 15". */
  parcels: ReactNode[];
  /** Where and when to pick up, in small grey type. */
  footer: ReactNode;
  /** The agent's own words, if any; highlighted so they are not missed. */
  note?: { label: ReactNode; text: ReactNode };
  className?: string;
};

/**
 * The pickup e-mail as it will be sent, laid out like a message card rather
 * than a form: the agent proofreads it, they do not fill it in.
 */
export function EmailDraft({
  subject,
  body,
  code,
  parcels,
  footer,
  note,
  className,
}: EmailDraftProps) {
  return (
    <article
      className={cn(
        'flex flex-col rounded-card bg-surface px-[18px] pt-4 pb-[18px] text-ink',
        className,
      )}
    >
      <p className="text-12 text-muted">Objet</p>
      <h2 className="mt-1 text-15 font-semibold">{subject}</h2>
      <hr className="mt-3 border-separator" />
      <p className="mt-[13px] text-13 leading-[18px]">{body}</p>
      {/* Blocks nested in the card are rounded 4 px tighter than it. */}
      <div className="mt-4 flex items-start gap-4 rounded-[calc(var(--radius-card)-4px)] bg-fill p-3">
        <QrGlyph />
        <div className="mt-1.5 flex flex-col gap-[3px]">
          <span className="text-11 text-muted">Code de retrait</span>
          <span className="font-mono text-24 font-semibold tracking-[3px]">
            {code}
          </span>
        </div>
      </div>
      <ul className="mt-[18px] flex flex-col gap-2">
        {parcels.map((parcel, i) => (
          <li key={i} className="text-13">
            {parcel}
          </li>
        ))}
      </ul>
      <hr className="mt-4 border-separator" />
      <p className="mt-[13px] text-12 leading-[17px] text-muted">{footer}</p>
      {note && (
        <div className="mt-3 flex flex-col rounded-[calc(var(--radius-card)-4px)] bg-orange-soft px-3.5 pt-3 pb-6">
          <span className="text-12 font-semibold text-orange-strong">
            {note.label}
          </span>
          <p className="mt-1.5 text-13 leading-[18px]">{note.text}</p>
        </div>
      )}
    </article>
  );
}

export type EmailTextProps = {
  subject: ReactNode;
  /** The body as the mail app receives it: plain text, line breaks kept. */
  body: ReactNode;
  className?: string;
};

/**
 * A mail written from the agent's own template, shown in the card of the
 * preview: plain text, since that is all a `mailto:` carries (S5).
 */
export function EmailText({ subject, body, className }: EmailTextProps) {
  return (
    <article
      className={cn(
        'flex flex-col rounded-card bg-surface px-[18px] pt-4 pb-[18px] text-ink',
        className,
      )}
    >
      <p className="text-12 text-muted">Objet</p>
      <h2 className="mt-1 text-15 font-semibold break-words">{subject}</h2>
      <hr className="mt-3 border-separator" />
      <p className="mt-[13px] text-13 leading-[18px] break-words whitespace-pre-wrap">
        {body}
      </p>
    </article>
  );
}
