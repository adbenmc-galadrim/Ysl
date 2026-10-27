import { listDevicesOutput, revokeDeviceInput } from '@repo/contract/devices';
import { db } from '@repo/db';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { TRPCError } from '@trpc/server';
import { adminMemberProcedure, router } from '#lib/trpc';
import { listDevices, revokeDevice } from '#features/devices/service';

const translate = createTranslator(DEFAULT_LOCALE);

export const devicesRouter = router({
  /** Réglages › Appareils connectés: who is signed in, on what, since when. */
  list: adminMemberProcedure.output(listDevicesOutput).query(({ ctx }) =>
    listDevices(db, {
      organizationId: ctx.organizationId,
      currentSessionId: ctx.session.session.id,
    }),
  ),
  /** "Déconnecter cet appareil": a lost or stolen phone, or one handed back. */
  revoke: adminMemberProcedure
    .input(revokeDeviceInput)
    .mutation(async ({ ctx, input }) => {
      const outcome = await revokeDevice(db, {
        organizationId: ctx.organizationId,
        currentSessionId: ctx.session.session.id,
        id: input.id,
      });
      if (outcome === 'current') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: translate('devices.error.current'),
        });
      }
      if (outcome === 'notFound') {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: translate('devices.error.notFound'),
        });
      }
    }),
});
