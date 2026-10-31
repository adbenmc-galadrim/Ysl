import { createAccessControl } from 'better-auth/plugins/access';
import { defaultStatements, userAc } from 'better-auth/plugins/admin/access';

export const ac = createAccessControl(defaultStatements);

export const roles = {
  // Better Auth's admin statements ignore companies: no role holds them.
  platform_admin: ac.newRole(userAc.statements),
  company_admin: ac.newRole(userAc.statements),
  department: ac.newRole(userAc.statements),
  shuttle: ac.newRole(userAc.statements),
};
