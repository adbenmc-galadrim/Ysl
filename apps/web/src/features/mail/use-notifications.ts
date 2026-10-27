import type { MailTarget } from '@repo/contract/mail';
import { useMemo } from 'react';
import { useSession } from '#/features/auth/api/use-session';
import { db } from '#/features/db/database';
import {
  markFailed,
  markOpened,
  markSent,
  prepareNotification,
  retargetNotification,
  type PrepareNotification,
} from '#/features/mail/notifications';

/**
 * The outbox of the signed-in agent, for the screens that compose a mail
 * (YSL-61) and follow it (YSL-63): prepare before the tap on the link,
 * `markOpened` when `Mailer.open` says the mail app took over, then what the
 * agent declares.
 */
export function useNotifications() {
  const userId = useSession().user.id;
  return useMemo(
    () => ({
      prepare: (input: PrepareNotification) =>
        prepareNotification(db, input, { userId }),
      markOpened: (id: string) => markOpened(db, id),
      retarget: (id: string, target: MailTarget | null) =>
        retargetNotification(db, id, target),
      markSent: (id: string) => markSent(db, id, { userId }),
      markFailed: (id: string, reason: string) => markFailed(db, id, reason),
    }),
    [userId],
  );
}
