import { z } from 'zod';
import { pickupSetting } from './settings';

export const DEPARTMENT_NAME_MAX = 120;
export const RECEPTION_POINT_MAX = 120;

const departmentId = z.uuid();
const name = z.string().trim().min(1).max(DEPARTMENT_NAME_MAX);
const receptionPoint = z
  .string()
  .trim()
  .max(RECEPTION_POINT_MAX)
  .transform((value) => value || null)
  .nullable();

export const department = z.object({
  id: departmentId,
  name: z.string(),
  receptionPoint: z.string().nullable(),
  pickup: pickupSetting,
});

export type Department = z.infer<typeof department>;

export const listDepartmentsOutput = z.array(department);

export const createDepartmentInput = z.object({
  name,
  receptionPoint: receptionPoint.default(null),
  pickup: pickupSetting.optional(),
});

export type CreateDepartmentInput = z.infer<typeof createDepartmentInput>;

export const updateDepartmentInput = z.object({
  id: departmentId,
  name,
  receptionPoint,
});

export type UpdateDepartmentInput = z.infer<typeof updateDepartmentInput>;

export const updateDepartmentPickupInput = z.object({
  id: departmentId,
  pickup: pickupSetting,
});

export const archiveDepartmentInput = z.object({ id: departmentId });

export const attachDepartmentAccountInput = z.object({
  userId: z.string().min(1),
  departmentId: departmentId.nullable(),
});

export type AttachDepartmentAccountInput = z.infer<
  typeof attachDepartmentAccountInput
>;
