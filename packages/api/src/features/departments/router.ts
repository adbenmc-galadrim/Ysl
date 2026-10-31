import { isCompanyAdmin } from '@repo/contract/auth';
import {
  archiveDepartmentInput,
  attachDepartmentAccountInput,
  createDepartmentInput,
  department,
  listDepartmentsOutput,
  updateDepartmentInput,
  updateDepartmentPickupInput,
} from '@repo/contract/departments';
import { db } from '@repo/db';
import {
  adminMemberProcedure,
  forbidden,
  memberProcedure,
  roleOf,
  router,
} from '#lib/trpc';
import {
  archiveDepartment,
  attachDepartmentAccount,
  createDepartment,
  listDepartments,
  updateDepartment,
  updateDepartmentPickup,
} from '#features/departments/service';

export const departmentsRouter = router({
  /** A department account only ever sees its own. */
  list: memberProcedure.output(listDepartmentsOutput).query(({ ctx }) => {
    if (roleOf(ctx.session) !== 'department') {
      return listDepartments(db, ctx.organizationId);
    }
    return ctx.departmentId
      ? listDepartments(db, ctx.organizationId, ctx.departmentId)
      : [];
  }),
  create: adminMemberProcedure
    .input(createDepartmentInput)
    .output(department)
    .mutation(({ ctx, input }) =>
      createDepartment(db, ctx.organizationId, input),
    ),
  update: adminMemberProcedure
    .input(updateDepartmentInput)
    .output(department)
    .mutation(({ ctx, input }) =>
      updateDepartment(db, ctx.organizationId, input),
    ),
  /** Place, hours and instructions: the company admin's, and the department's own (§3.7.9). */
  updatePickup: memberProcedure
    .input(updateDepartmentPickupInput)
    .output(department)
    .mutation(({ ctx, input }) => {
      const role = roleOf(ctx.session);
      const ownDepartment =
        role === 'department' && ctx.departmentId === input.id;
      if (!isCompanyAdmin(role) && !ownDepartment) {
        throw forbidden();
      }
      return updateDepartmentPickup(
        db,
        ctx.organizationId,
        input.id,
        input.pickup,
      );
    }),
  archive: adminMemberProcedure
    .input(archiveDepartmentInput)
    .mutation(({ ctx, input }) =>
      archiveDepartment(db, ctx.organizationId, input.id),
    ),
  attachAccount: adminMemberProcedure
    .input(attachDepartmentAccountInput)
    .mutation(({ ctx, input }) =>
      attachDepartmentAccount(db, ctx.organizationId, input),
    ),
});
