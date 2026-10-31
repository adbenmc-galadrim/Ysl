import { parcelsCsvOutput, selectionCsvInput } from '@repo/contract/exports';
import { db } from '@repo/db';
import { parcelScope } from '#lib/access';
import { router, scopedProcedure } from '#lib/trpc';
import { exportParcelsCsv } from '#features/exports/service';

export const exportsRouter = router({
  parcelsCsv: scopedProcedure
    .output(parcelsCsvOutput)
    .query(({ ctx }) =>
      exportParcelsCsv(db, ctx.organizationId, new Date(), undefined, parcelScope(ctx.access)),
    ),
  selectionCsv: scopedProcedure
    .input(selectionCsvInput)
    .output(parcelsCsvOutput)
    .mutation(({ ctx, input }) =>
      exportParcelsCsv(
        db,
        ctx.organizationId,
        new Date(),
        input.parcelIds,
        parcelScope(ctx.access),
      ),
    ),
});
