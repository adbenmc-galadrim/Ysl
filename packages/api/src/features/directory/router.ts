import {
  closeMoveRequestInput,
  directoryImportInput,
  directoryImportPreview,
  directoryImportReport,
  moveEffects,
  moveEffectsInput,
  movePersonInput,
  moveRequests,
  requestMoveInput,
} from '@repo/contract/directory';
import { db } from '@repo/db';
import {
  adminMemberProcedure,
  departmentProcedure,
  directoryKeeperProcedure,
  router,
} from '#lib/trpc';
import {
  applyDirectoryImport,
  previewDirectoryImport,
} from '#features/directory/import';
import {
  closeMoveRequest,
  moveEffectsOf,
  movePerson,
  moveRequestsOf,
  requestMove,
} from '#features/directory/service';

/** What goes online: moves, requests, imports (ME21). Cards are written through `sync.push`. */
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
  requestMove: departmentProcedure
    .input(requestMoveInput)
    .mutation(({ ctx, input }) => requestMove(db, ctx.access, input)),
  moveRequests: directoryKeeperProcedure
    .output(moveRequests)
    .query(({ ctx }) => moveRequestsOf(db, ctx.access)),
  closeMoveRequest: directoryKeeperProcedure
    .input(closeMoveRequestInput)
    .mutation(({ ctx, input }) =>
      closeMoveRequest(db, ctx.access, input.personId),
    ),
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
