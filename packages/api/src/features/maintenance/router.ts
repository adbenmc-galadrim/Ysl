import { purgeNowOutput, purgeStatusOutput } from '@repo/contract/retention';
import { db, withConnection } from '@repo/db';
import { adminMemberProcedure, router } from '#lib/trpc';
import { lastPurge, runPurge } from '#features/maintenance/purge';

export const maintenanceRouter = router({
  /** Réglages › Données et confidentialité: when the mailroom was last purged, and of what. */
  status: adminMemberProcedure
    .output(purgeStatusOutput)
    .query(async ({ ctx }) => ({
      last: await lastPurge(db, ctx.organizationId),
    })),
  /** "Purger maintenant": the purge of the admin's mailroom, at once. */
  purgeNow: adminMemberProcedure
    .output(purgeNowOutput)
    .mutation(async ({ ctx }) => {
      const outcome = await withConnection((conn) =>
        runPurge(conn, {
          organizationId: ctx.organizationId,
          trigger: 'manual',
          userId: ctx.session.user.id,
        }),
      );
      if (outcome.status === 'busy') return outcome;
      return { status: 'done' as const, run: outcome.runs[0]! };
    }),
});
