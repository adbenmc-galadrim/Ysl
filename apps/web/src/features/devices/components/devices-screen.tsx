import type { Device } from '@repo/contract/devices';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import {
  Banner,
  Button,
  GroupedFootnote,
  GroupedRow,
  GroupedSection,
  SettingsScreen,
  Sheet,
} from '@repo/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { deviceKind, deviceSubtitle } from '#/features/devices/describe';
import { trpcClient } from '#/lib/trpc';
import { useOnline } from '#/lib/use-online';

const t = createTranslator(DEFAULT_LOCALE);

const DEVICES_KEY = ['devices', 'list'] as const;

/** Another admin may have signed the device out first: say so, the list is refreshed. */
function revokeMessage(error: unknown): string {
  const code = (error as { data?: { code?: string } } | null)?.data?.code;
  return code === 'NOT_FOUND'
    ? t('devices.error.notFound')
    : t('devices.revoke.failed');
}

/**
 * Réglages › Appareils connectés (admin): every session open in the
 * mailroom, and "Déconnecter cet appareil" for a phone lost, stolen or
 * handed back (§9.1). The server deletes the session; the device empties
 * itself at its next request.
 */
export function DevicesScreen() {
  const navigate = useNavigate();
  const online = useOnline();
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<Device | null>(null);

  const devices = useQuery({
    queryKey: DEVICES_KEY,
    queryFn: () => trpcClient.devices.list.query(),
    enabled: online,
  });

  const revoke = useMutation({
    mutationFn: (id: string) => trpcClient.devices.revoke.mutate({ id }),
    onSuccess: async () => {
      setTarget(null);
      await queryClient.invalidateQueries({ queryKey: DEVICES_KEY });
    },
    onError: () => queryClient.invalidateQueries({ queryKey: DEVICES_KEY }),
  });

  const placeholder = devices.data
    ? null
    : !online
      ? t('devices.offline')
      : devices.isError
        ? t('devices.failed')
        : t('devices.loading');

  return (
    <>
      <SettingsScreen
        title={t('devices.title')}
        onBack={() => void navigate({ to: '/reglages' })}
      >
        {revoke.isSuccess && (
          <div role="status">
            <Banner
              tone="green"
              icon="check"
              title={t('devices.revoke.done')}
            />
          </div>
        )}
        <GroupedSection header={t('devices.header')}>
          {placeholder ? (
            <GroupedRow title={placeholder} />
          ) : (
            devices.data?.map((device) => (
              <GroupedRow
                key={device.id}
                title={device.userName}
                subtitle={deviceSubtitle(device, t)}
                accessory={device.current ? undefined : 'chevron'}
                onClick={
                  device.current
                    ? undefined
                    : () => {
                        revoke.reset();
                        setTarget(device);
                      }
                }
              />
            ))
          )}
        </GroupedSection>
        <GroupedFootnote>{t('devices.footer')}</GroupedFootnote>
      </SettingsScreen>
      {target && (
        <Sheet
          fixed
          title={t('devices.revoke.title')}
          description={
            revoke.isError
              ? revokeMessage(revoke.error)
              : t('devices.revoke.description', {
                  name: target.userName,
                  kind: t(`devices.kind.${deviceKind(target.userAgent)}`),
                })
          }
          className="pb-[calc(var(--safe-bottom)+16px)]"
          onDismiss={() => setTarget(null)}
        >
          <Button
            variant="destructive"
            block
            disabled={revoke.isPending || !online}
            className="mt-6"
            onClick={() => revoke.mutate(target.id)}
          >
            {t('devices.revoke.confirm')}
          </Button>
          <Button
            variant="secondary"
            block
            className="mt-3"
            onClick={() => setTarget(null)}
          >
            {t('devices.revoke.cancel')}
          </Button>
        </Sheet>
      )}
    </>
  );
}
