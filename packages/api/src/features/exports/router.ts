import { parcelsCsvInput, parcelsCsvOutput } from '@repo/contract/exports';
import { db } from '@repo/db';
import { memberProcedure, router } from '#lib/trpc';
import { exportParcelsCsv } from '#features/exports/service';

export const exportsRouter = router({
  parcelsCsv: memberProcedure
    .input(parcelsCsvInput)
    .output(parcelsCsvOutput)
    .query(({ ctx, input }) =>
      exportParcelsCsv(db, ctx.organizationId, new Date(), input?.parcelIds),
    ),
});
