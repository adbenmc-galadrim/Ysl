import { createFileRoute, redirect } from '@tanstack/react-router';
import { db } from '#/features/db/database';
import { announceHandover } from '#/features/handover/done-toast';
import { firstNameOf, loadHandoverPerson } from '#/features/handover/recipient';

/**
 * Where a recorded handover leads. Until the « Remise confirmée » screen
 * (YSL-76), back to Colis with the toast that says it.
 */
export const Route = createFileRoute('/_authenticated/remise/confirmee')({
  validateSearch: (search: Record<string, unknown>) => ({
    handover: typeof search.handover === 'string' ? search.handover : '',
  }),
  beforeLoad: async ({ search }) => {
    const handover = search.handover
      ? await db.handover.get(search.handover)
      : undefined;
    if (handover && !handover.cancelledAt) {
      const person = await loadHandoverPerson(
        db,
        handover.personId
          ? { kind: 'person', id: handover.personId }
          : { kind: 'contact', id: handover.contactId ?? '' },
      );
      announceHandover({
        kind: 'done',
        count: handover.parcelIds.length,
        firstName: person?.firstName ?? firstNameOf(handover.recipientName),
      });
    }
    throw redirect({ to: '/', replace: true });
  },
});
