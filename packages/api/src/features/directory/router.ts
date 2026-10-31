import {
  directoryImportInput,
  directoryImportPreview,
  directoryImportReport,
  moveEffects,
  moveEffectsInput,
  movePersonInput,
} from '@repo/contract/directory';
import { db } from '@repo/db';
import { adminMemberProcedure, router } from '#lib/trpc';
import {
  applyDirectoryImport,
  previewDirectoryImport,
} from '#features/directory/import';
import { moveEffectsOf, movePerson } from '#features/directory/service';

/** What the company admin alone does (ME21); cards are written through `sync.push`. */
export const directoryRouter = router({
  moveEffects: adminMemberProcedure
    .input(moveEffectsInput)
    .output(moveEffects)
    .query(({ ctx, input }) =>
      moveEffectsOf(db, ctx.organizationId, input.personId),
    ),
  move: adminMemberProcedure
    .input(movePersonInput)
    .output(moveEffects)
    .mutation(({ ctx, input }) => movePerson(db, ctx.organizationId, input)),
  previewImport: adminMemberProcedure
    .input(directoryImportInput)
    .output(directoryImportPreview)
    .mutation(({ ctx, input }) =>
      previewDirectoryImport(db, ctx.organizationId, input.csv, input.choices),
    ),
  applyImport: adminMemberProcedure
    .input(directoryImportInput)
    .output(directoryImportReport)
    .mutation(({ ctx, input }) =>
      applyDirectoryImport(db, ctx.organizationId, input.csv, input.choices),
    ),
});
