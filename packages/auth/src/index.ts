import { auth } from '#auth';

export { isAPIError } from 'better-auth/api';
export { auth, CLIENT_IP_HEADER } from '#auth';

export type Session = typeof auth.$Infer.Session;
export type User = Session['user'];
