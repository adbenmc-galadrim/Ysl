import {
  operatingSettings,
  saveOperatingProfileInput,
  saveOperatingProfileOutput,
} from '@repo/contract/operating-profile';
import { db } from '@repo/db';
import {
  getOperatingSettings,
  saveOperatingProfile,
} from '#features/operating/service';
import { adminMemberProcedure, router } from '#lib/trpc';

export const operatingRouter = router({
  /** Réglages › Fonctionnement: the profile, and the parcels under way a change would touch. */
  get: adminMemberProcedure
    .output(operatingSettings)
    .query(({ ctx }) => getOperatingSettings(db, ctx.organizationId)),
  /** Freely, with no lock (D30). */
  save: adminMemberProcedure
    .input(saveOperatingProfileInput)
    .output(saveOperatingProfileOutput)
    .mutation(({ ctx, input }) =>
      saveOperatingProfile(
        db,
        ctx.organizationId,
        input.profile,
        ctx.session.user.id,
      ),
    ),
});
