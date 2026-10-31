import {
  operatingImpact,
  stepsChangedFromModel,
  type OperatingProfile,
  type ProfileModel,
} from '@repo/contract/operating-profile';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import {
  Banner,
  BottomBar,
  Button,
  GroupedRow,
  GroupedSection,
  NavBar,
  PhoneGroup,
  PhoneGroupTitle,
  PhoneSegments,
  Screen,
  Sheet,
  Toast,
} from '@repo/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { impactLine } from '#/features/settings/operating-impact';
import {
  choiceOf,
  OPTIONS,
  SECTIONS,
  withChoice,
} from '#/features/settings/operating-steps';
import { trpcClient } from '#/lib/trpc';
import { useOnline } from '#/lib/use-online';

const t = createTranslator(DEFAULT_LOCALE);

const OPERATING_KEY = ['operating', 'get'] as const;

/** Undoing skips the announcement: only while it is still the one just read. */
const UNDO_MS = 10_000;

function startModelLine(model: ProfileModel, profile: OperatingProfile) {
  const count = stepsChangedFromModel(model, profile);
  const name = t(`platform.model.${model}`);
  if (count === 0) return t('operating.startModel.none', { model: name });
  return count === 1
    ? t('operating.startModel.one', { model: name })
    : t('operating.startModel.many', { model: name, count });
}

/**
 * Réglages › Fonctionnement (admin): every step of the company, freely (D30).
 * It reads the server, which alone counts every parcel of the company; the
 * announcement comes before anything is saved (D31, ME17).
 */
export function OperatingScreen() {
  const navigate = useNavigate();
  const online = useOnline();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<OperatingProfile | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [saved, setSaved] = useState<{
    applied: number;
    previous: OperatingProfile;
  } | null>(null);

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [saved]);

  const query = useQuery({
    queryKey: OPERATING_KEY,
    queryFn: () => trpcClient.operating.get.query(),
    enabled: online,
  });
  const save = useMutation({
    mutationFn: (profile: OperatingProfile) =>
      trpcClient.operating.save.mutate({ profile }),
    onSuccess: ({ profile, counts, profileModel }) => {
      queryClient.setQueryData(OPERATING_KEY, {
        profile,
        counts,
        profileModel,
      });
      setDraft(null);
      setConfirming(false);
    },
  });

  const settings = query.data;
  const placeholder = settings
    ? null
    : !online
      ? t('operating.offline')
      : query.isError
        ? t('operating.failed')
        : t('operating.loading');
  const value = draft ?? settings?.profile;
  const impact =
    settings && value
      ? operatingImpact(settings.profile, value, settings.counts)
      : null;
  const changed = impact?.changes.map((change) => change.param) ?? [];
  const pending = changed.length;

  const failed = query.isRefetchError || (save.isError && !confirming);

  const apply = () => {
    if (!settings || !value) return;
    const previous = settings.profile;
    save.mutate(value, {
      onSuccess: ({ applied }) => setSaved({ applied, previous }),
    });
  };
  const undo = () => {
    if (!saved) return;
    save.mutate(saved.previous, { onSuccess: () => setSaved(null) });
  };

  return (
    <Screen
      tone="fill"
      bottomInset={pending > 0 || saved ? 128 : 24}
      bottom={
        pending > 0 || saved || failed ? (
          <BottomBar
            surface={pending > 0 ? 'line' : 'none'}
            className="flex flex-col gap-3 pt-[23px] pb-9"
          >
            {failed && (
              <Banner
                tone="red"
                icon="alert"
                title={t('operating.saveFailed')}
              />
            )}
            {pending > 0 ? (
              <Button
                block
                disabled={!online || query.isFetching}
                onClick={() => {
                  setSaved(null);
                  save.reset();
                  void query.refetch().then(({ isError }) => {
                    if (!isError) setConfirming(true);
                  });
                }}
              >
                {pending === 1
                  ? t('operating.save.one')
                  : t('operating.save.many', { count: pending })}
              </Button>
            ) : (
              saved && (
                <Toast
                  message={
                    saved.applied > 0
                      ? t('operating.saved', { count: saved.applied })
                      : t('operating.saved.none')
                  }
                  actionLabel={t('operating.undo')}
                  onAction={undo}
                  actionDisabled={save.isPending}
                  className="w-full rounded-[14px] px-4"
                />
              )
            )}
          </BottomBar>
        ) : undefined
      }
    >
      <NavBar
        title={t('operating.title')}
        onBack={() => void navigate({ to: '/reglages' })}
      />
      {placeholder ? (
        <GroupedSection className="mt-3">
          <GroupedRow title={placeholder} />
        </GroupedSection>
      ) : (
        value && (
          <>
            {settings?.profileModel && (
              <p className="mt-3 text-13 text-muted">
                {startModelLine(settings.profileModel, settings.profile)}
              </p>
            )}
            <Banner
              tone="orange"
              icon="info"
              className="mt-3"
              title={t('operating.notYet')}
            />
            {SECTIONS.map((section) => (
              <section key={section.id}>
                <PhoneGroupTitle className="mt-4">
                  {t(`operating.section.${section.id}`)}
                </PhoneGroupTitle>
                <PhoneGroup className="mt-1.5 divide-y divide-separator px-4">
                  {section.params.map((param) => (
                    <div key={param} className="relative py-3">
                      <p className="text-16 font-semibold">
                        {t(`operating.param.${param}`)}
                      </p>
                      <p className="mt-1 text-13 text-muted">
                        {t(`operating.help.${param}`)}
                      </p>
                      <PhoneSegments
                        options={OPTIONS[param]}
                        value={choiceOf(value, param)}
                        label={t(`operating.param.${param}`)}
                        className="mt-[7px] h-11 w-full max-w-[321px] rounded-full"
                        optionClassName="h-10 rounded-full pb-[3px] text-14 outline-none focus-visible:ring-2 focus-visible:ring-blue"
                        onChange={(choice) => {
                          save.reset();
                          setSaved(null);
                          setConfirming(false);
                          setDraft(withChoice(value, param, choice));
                        }}
                      />
                      {changed.includes(param) && (
                        <span className="absolute top-2.5 right-0 flex h-[22px] w-[61px] items-center justify-center rounded-full bg-fill text-12 font-semibold">
                          {t('operating.modified')}
                        </span>
                      )}
                    </div>
                  ))}
                </PhoneGroup>
              </section>
            ))}
          </>
        )
      )}
      {confirming && impact && pending > 0 && (
        <Sheet
          fixed
          title={
            impact.parcels > 0
              ? t('operating.apply.title', { count: impact.parcels })
              : t('operating.apply.title.none')
          }
          description={t('operating.apply.description')}
          onDismiss={() => setConfirming(false)}
        >
          <div className="mt-4 flex max-h-[40dvh] flex-col gap-3 overflow-y-auto">
            {impact.changes.map((change) => (
              <div key={change.param}>
                <p className="text-15 font-semibold">
                  {t(`operating.param.${change.param}`)}
                </p>
                <p className="mt-0.5 text-14 text-muted">
                  {impactLine(change)}
                </p>
              </div>
            ))}
          </div>
          {changed.some((param) => param !== 'shuttleActsAsDepartment') && (
            <p className="mt-3 text-13 text-muted">{t('operating.notYet')}</p>
          )}
          {save.isError && (
            <p role="alert" className="mt-3 text-14 text-red">
              {t('operating.saveFailed')}
            </p>
          )}
          <Button
            block
            className="mt-6"
            disabled={save.isPending || !online}
            onClick={apply}
          >
            {impact.parcels > 0
              ? t('operating.apply', { count: impact.parcels })
              : t('operating.apply.none')}
          </Button>
          <Button
            block
            variant="secondary"
            className="mt-3"
            onClick={() => setConfirming(false)}
          >
            {t('operating.apply.back')}
          </Button>
        </Sheet>
      )}
    </Screen>
  );
}
