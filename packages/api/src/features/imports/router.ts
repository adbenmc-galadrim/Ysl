import { v1CsvInput, v1ImportReport } from '@repo/contract/imports';
import { db } from '@repo/db';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { adminMemberProcedure, router } from '#lib/trpc';
import { importV1Csv } from '#features/imports/service';

const translate = createTranslator(DEFAULT_LOCALE);

export const importsRouter = router({
  v1Csv: adminMemberProcedure
    .input(v1CsvInput)
    .output(v1ImportReport)
    .mutation(({ ctx, input }) =>
      importV1Csv(
        db,
        {
          organizationId: ctx.organizationId,
          userId: ctx.session.user.id,
        },
        input.csv,
        translate,
      ),
    ),
});
