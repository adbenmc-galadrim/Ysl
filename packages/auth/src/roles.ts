import { createAccessControl } from 'better-auth/plugins/access';
import {
  adminAc,
  defaultStatements,
  userAc,
} from 'better-auth/plugins/admin/access';

export const ac = createAccessControl(defaultStatements);

export const roles = {
  admin: ac.newRole(adminAc.statements),
  agent: ac.newRole(userAc.statements),
  // Better Auth's admin statements ignore companies: `admin` alone keeps them until the conversion.
  platform_admin: ac.newRole(userAc.statements),
  company_admin: ac.newRole(userAc.statements),
  department: ac.newRole(userAc.statements),
  shuttle: ac.newRole(userAc.statements),
};
