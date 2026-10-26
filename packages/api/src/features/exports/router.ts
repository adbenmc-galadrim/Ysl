import { parcelsCsvOutput } from '@repo/contract/exports';
import { db } from '@repo/db';
import { memberProcedure, router } from '#lib/trpc';
import { exportParcelsCsv } from '#features/exports/service';

export const exportsRouter = router({
  parcelsCsv: memberProcedure
    .output(parcelsCsvOutput)
    .query(({ ctx }) => exportParcelsCsv(db, ctx.organizationId)),
});
