import {
  confirmDepositInput,
  confirmDepositOutput,
  entrustParcelsInput,
  settlementOutput,
  settleParcelInput,
} from '@repo/contract/deposits';
import { tourParcelsOutput } from '@repo/contract/tour';
import { db } from '@repo/db';
import {
  adminMemberProcedure,
  forbidden,
  memberProcedure,
  roleOf,
  router,
} from '#lib/trpc';
import {
  confirmDeposit,
  entrustParcels,
  settleParcel,
  settlementOf,
} from '#features/deposits/service';

/** The count is the department's own (§2.1): no other role confirms. */
const departmentProcedure = memberProcedure.use(({ ctx, next }) => {
  if (roleOf(ctx.session) !== 'department' || !ctx.departmentId) {
    throw forbidden();
  }
  return next();
});

const actorOf = (ctx: {
  organizationId: string;
  session: { user: { id: string; name: string | null } };
}) => ({
  organizationId: ctx.organizationId,
  userId: ctx.session.user.id,
  name: ctx.session.user.name,
});

export const depositsRouter = router({
  confirm: departmentProcedure
    .input(confirmDepositInput)
    .output(confirmDepositOutput)
    .mutation(({ ctx, input }) =>
      db.transaction((tx) =>
        confirmDeposit(tx, actorOf(ctx), ctx.departmentId, input),
      ),
    ),
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
