import { z } from 'zod';

/**
 * A device signed in to the mailroom: one session of one of its members.
 * Revoking it signs that device out at its next request (§9.1).
 */
export const device = z.object({
  id: z.string(),
  userName: z.string(),
  userEmail: z.string(),
  userAgent: z.string().nullable(),
  createdAt: z.date(),
  lastActiveAt: z.date(),
  /** The device the admin is holding: erased from Données, not from here. */
  current: z.boolean(),
});

export type Device = z.infer<typeof device>;

export const listDevicesOutput = z.array(device);

export const revokeDeviceInput = z.object({ id: z.string().min(1) });
