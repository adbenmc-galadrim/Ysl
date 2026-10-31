import {
  confirmDepositInput,
  confirmDepositOutput,
  entrustParcelsInput,
  settlementOutput,
  settleParcelInput,
} from '@repo/contract/deposits';
import { confirmsEachParcel } from '@repo/contract/operating-profile';
import { tourParcelsOutput } from '@repo/contract/tour';
import { db } from '@repo/db';
import { adminMemberProcedure, departmentProcedure, router } from '#lib/trpc';
import {
  confirmDeposit,
  entrustParcels,
  settleParcel,
  settlementOf,
} from '#features/deposits/service';
import { readOperatingProfile } from '#features/operating/service';

const actorOf = (ctx: {
  organizationId: string;
  session: { user: { id: string; name: string | null } };
}) => ({
  organizationId: ctx.organizationId,
  userId: ctx.session.user.id,
  name: ctx.session.user.name,
});

export const depositsRouter = router({
  /** The count is the department's own (§2.1): no other role confirms. */
  confirm: departmentProcedure
    .input(confirmDepositInput)
    .output(confirmDepositOutput)
    .mutation(async ({ ctx, input }) => {
      const profile = await readOperatingProfile(db, ctx.organizationId);
      return db.transaction((tx) =>
        confirmDeposit(tx, actorOf(ctx), ctx.departmentId, input, {
          each: confirmsEachParcel(profile),
        }),
      );
    }),
  settlement: adminMemberProcedure
    .output(settlementOutput)
    .query(({ ctx }) => settlementOf(db, ctx.organizationId)),
  settle: adminMemberProcedure
    .input(settleParcelInput)
    .mutation(async ({ ctx, input }) => {
      await db.transaction((tx) => settleParcel(tx, actorOf(ctx), input));
    }),
  entrust: adminMemberProcedure
    .input(entrustParcelsInput)
    .output(tourParcelsOutput)
    .mutation(async ({ ctx, input }) => ({
      parcels: await db.transaction((tx) =>
        entrustParcels(tx, actorOf(ctx), input.parcelIds, input.shuttleId),
      ),
    })),
});
