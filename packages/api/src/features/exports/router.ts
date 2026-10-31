import { parcelsCsvOutput, selectionCsvInput } from '@repo/contract/exports';
import { db } from '@repo/db';
import { router, wholeCompanyProcedure } from '#lib/trpc';
import { exportParcelsCsv } from '#features/exports/service';

export const exportsRouter = router({
  parcelsCsv: wholeCompanyProcedure
    .output(parcelsCsvOutput)
    .query(({ ctx }) => exportParcelsCsv(db, ctx.organizationId)),
  selectionCsv: wholeCompanyProcedure
    .input(selectionCsvInput)
    .output(parcelsCsvOutput)
    .mutation(({ ctx, input }) =>
      exportParcelsCsv(db, ctx.organizationId, new Date(), input.parcelIds),
    ),
});
