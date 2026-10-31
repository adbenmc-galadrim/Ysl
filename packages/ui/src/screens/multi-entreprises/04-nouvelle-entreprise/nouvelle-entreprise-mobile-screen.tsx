import type { ReactNode } from 'react';

import { BottomBar } from '#components/bottom-bar';
import { Button } from '#components/button';
import { SettingsIcon } from '#components/grouped-list';
import {
  PhoneField,
  PhoneGroupTitle,
  PhoneNav,
  PhoneSettingRow,
} from '#components/phone-parts';
import { Screen } from '#components/screen';
import { Icon, type IconName } from '#icons';
import { cn } from '#lib/tv';
import {
  optionOf,
  STEP_GROUPS,
  type WizardStepGroup,
} from '#screens/multi-entreprises/04-nouvelle-entreprise/steps';

function Bar({ children }: { children: ReactNode }) {
  return (
    <BottomBar surface="line" className="pt-[23px] pb-9">
      {children}
    </BottomBar>
  );
}

function StepOf({ step, total = 3 }: { step: number; total?: number }) {
  return (
    <span
      className={cn(
        'relative -top-px text-15 text-muted',
        step === 1 ? 'w-[42px]' : 'w-[45px]',
      )}
    >
      {step} sur {total}
    </span>
  );
}

export type ProfileModelPhoneCard = {
  id?: string;
  icon: IconName;
  name: string;
  description: string;
  selected?: boolean;
};

const PHONE_MODELS: ProfileModelPhoneCard[] = [
  {
    icon: 'truck',
    name: 'Petit site, la navette remet',
    description: 'Un seul lieu de retrait : la navette scanne et remet elle-même.',
  },
  {
    icon: 'building',
    name: 'Multi-départements',
    description: 'Plusieurs départements, chacun avec son point de réception.',
    selected: true,
  },
  {
    icon: 'shield',
    name: 'Traçabilité stricte',
    description: 'Chaque geste est prouvé, du dépôt à la remise.',
  },
];

/** Step 1 on the phone: the name, then one model out of three. */
export function NouvelleEntrepriseModeleMobile({
  name = 'Atelier Lumen',
  onName,
  models = PHONE_MODELS,
  onSelectModel,
  confirmLabel = 'Continuer',
  confirmDisabled = false,
  onConfirm,
  onCancel,
  totalSteps,
  error,
}: {
  name?: string;
  onName?: (name: string) => void;
  models?: ProfileModelPhoneCard[];
  onSelectModel?: (id: string) => void;
  confirmLabel?: string;
  confirmDisabled?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
  totalSteps?: number;
  error?: string;
} = {}) {
  return (
    <Screen
      tone="fill"
      className="pt-[calc(var(--safe-top)+6px)]"
      bottom={
        <Bar>
          <Button block disabled={confirmDisabled} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </Bar>
      }
    >
      <PhoneNav
        icon="x"
        title="Nouvelle entreprise"
        trailing={<StepOf step={1} total={totalSteps} />}
        onBack={onCancel}
      />
      <PhoneField
        label="Nom de l’entreprise"
        value={name}
        onChange={onName}
        error={Boolean(error)}
        className="mt-4"
      />
      {error && (
        <p role="alert" className="mt-1.5 text-13 text-red">
          {error}
        </p>
      )}
      <PhoneGroupTitle className="mt-6">
        Modèle de fonctionnement
      </PhoneGroupTitle>
      <div className="mt-2.5 flex flex-col gap-3">
        {models.map((model) => (
          <div
            key={model.name}
            role="radio"
            aria-checked={Boolean(model.selected)}
            tabIndex={onSelectModel ? 0 : undefined}
            onClick={() => model.id && onSelectModel?.(model.id)}
            className={cn(
              'relative h-[138px] rounded-[16px] bg-surface',
              onSelectModel && 'cursor-pointer',
              model.selected
                ? 'shadow-[0_0_0_1px_var(--color-ink),inset_0_0_0_1px_var(--color-ink)]'
                : 'shadow-[inset_0_0_0_1px_var(--color-separator)]',
            )}
          >
            <span
              className={cn(
                'absolute top-4 left-4 flex size-11 items-center justify-center rounded-full',
                model.selected ? 'bg-ink text-on-ink' : 'bg-fill text-ink',
              )}
            >
              <Icon name={model.icon} size={22} />
            </span>
            <span
              className={cn(
                'absolute top-4 right-4 flex size-6 items-center justify-center rounded-full',
                model.selected
                  ? 'bg-ink text-on-ink'
                  : 'shadow-[inset_0_0_0_1.5px_var(--color-border)]',
              )}
            >
              {model.selected && <Icon name="tick" size={14} />}
            </span>
            <h3 className="absolute top-[18px] left-[72px] text-17 font-bold">
              {model.name}
            </h3>
            <p className="absolute top-[43px] left-[72px] w-[261px] text-14 leading-[19px] text-muted">
              {model.description}
            </p>
          </div>
        ))}
      </div>
    </Screen>
  );
}

/** Step 2 on the phone: the same steps, one segmented control each. */
export function NouvelleEntrepriseFonctionnementMobile({
  totalSteps,
  groups = STEP_GROUPS,
  summary = 'Multi-départements · 1 étape modifiée',
  notice,
  onChoose,
  onRevert,
  onBack,
  confirmLabel = 'Continuer',
  confirmDisabled = false,
  onConfirm,
}: {
  totalSteps?: number;
  groups?: WizardStepGroup[];
  summary?: string;
  notice?: string;
  onChoose?: (step: string, value: string) => void;
  onRevert?: () => void;
  onBack?: () => void;
  confirmLabel?: string;
  confirmDisabled?: boolean;
  onConfirm?: () => void;
} = {}) {
  return (
    <Screen
      tone="fill"
      className="pt-[calc(var(--safe-top)+6px)]"
      bottom={
        <Bar>
          <Button block disabled={confirmDisabled} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </Bar>
      }
    >
      <PhoneNav
        title="Fonctionnement"
        trailing={<StepOf step={2} total={totalSteps} />}
        onBack={onBack}
      />
      <p className="mt-4 text-15 text-muted">{summary}</p>
      {onRevert && (
        <button
          type="button"
          onClick={onRevert}
          className="mt-1 cursor-pointer self-start text-15 font-semibold"
        >
          Revenir au modèle
        </button>
      )}
      {notice && <p className="mt-2 text-13 text-orange-strong">{notice}</p>}
      {groups.map((group, g) => (
        <section key={group.title}>
          <PhoneGroupTitle className={cn('top-0', g === 0 ? 'mt-[17px]' : 'mt-5')}>{group.title}</PhoneGroupTitle>
          <div className="mt-1.5 rounded-[14px] bg-surface px-4">
            {group.steps.map((step, i) => (
              <div key={step.title} className="relative h-[118px] pt-[15px]">
                {i > 0 && (
                  <div className="absolute -top-px right-0 left-0 h-px bg-separator" />
                )}
                <p className="text-16 font-semibold">{step.title}</p>
                <p className="mt-[3px] text-13 text-muted">{step.hint}</p>
                {step.modified && (
                  <span className="absolute top-3.5 right-0 flex h-[22px] w-[61px] items-center justify-center rounded-full bg-fill text-12 font-semibold">
                    Modifié
                  </span>
                )}
                <div
                  role="radiogroup"
                  aria-label={step.title}
                  className="absolute top-[60px] flex h-11 w-full rounded-full bg-fill-2 p-0.5"
                >
                  {step.options.map(optionOf).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={option.value === step.value}
                      onClick={() =>
                        step.id && onChoose?.(step.id, option.value)
                      }
                      className={cn(
                        'flex h-10 flex-1 cursor-pointer items-center justify-center rounded-full text-14 font-semibold',
                        option.value === step.value
                          ? 'bg-ink text-on-ink'
                          : 'text-ink-2',
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </Screen>
  );
}

function AdminStepLayout({ error = false }: { error?: boolean }) {
  return (
    <Screen
      tone="fill"
      className="pt-[calc(var(--safe-top)+6px)]"
      bottom={
        <Bar>
          <Button block icon="send" iconSize={20} className="gap-2">
            Créer et inviter
          </Button>
        </Bar>
      }
    >
      <PhoneNav title="Administrateur" trailing={<StepOf step={3} />} />
      <p className="mt-4 text-15 leading-[18px] text-muted">
        Il gère ensuite les comptes, les départements, l’annuaire et le
        fonctionnement.
      </p>
      <PhoneField
        label="Prénom et nom"
        value="Claire Bonnet"
        className="mt-[18px]"
      />
      <PhoneField
        label="E-mail professionnel"
        value={error ? 'c.bonnet@maison-ferrand.fr' : 'claire.bonnet@atelier-lumen.fr'}
        error={error}
        className="mt-4"
      />
      {error ? (
        <p className="mt-[5px] text-13 leading-4 text-red">
          Cette adresse a déjà un compte chez un autre client. Utilisez son
          adresse chez Atelier Lumen.
        </p>
      ) : (
        <>
          <p className="mt-[5px] text-13 text-muted">
            Un lien valable 7 jours lui sera envoyé.
          </p>
          <div className="mt-[37px] h-[156px] rounded-[14px] bg-surface">
            <PhoneSettingRow title="Entreprise" value="Atelier Lumen" raised chevron={false} separator />
            <PhoneSettingRow title="Modèle" value="Multi-départements" chevron={false} separator />
            <PhoneSettingRow title="Étape modifiée" value="Signature" chevron={false} />
          </div>
        </>
      )}
    </Screen>
  );
}

/** Step 3 on the phone: who will administer the company. */
export function NouvelleEntrepriseAdministrateurMobile() {
  return <AdminStepLayout />;
}

/** Step 3 when the address already has an account with another client. */
export function NouvelleEntrepriseErreurAdresseMobile() {
  return <AdminStepLayout error />;
}

/** The end of the journey: the company exists, its invitation has left. */
export function NouvelleEntrepriseCreeeMobile() {
  return (
    <Screen
      className="pt-[calc(var(--safe-top)+170px)]"
      bottom={
        <BottomBar surface="plain" className="pt-6 pb-9">
          <Button block>Voir la fiche</Button>
        </BottomBar>
      }
    >
      <span className="ml-[132px] flex size-[88px] items-center justify-center rounded-full bg-green text-white">
        <Icon name="tick" size={44} />
      </span>
      <h1 className="mt-8 text-center text-26 font-bold">
        Atelier Lumen est créée
      </h1>
      <p className="mx-auto mt-[9px] w-[300px] text-center text-15 leading-[18px] text-muted">
        Invitation envoyée à claire.bonnet@atelier-lumen.fr. Le lien est valable
        7 jours.
      </p>
      <div className="mt-[54px] h-[104px] rounded-[14px] bg-fill">
        <PhoneSettingRow
          leading={<SettingsIcon icon="mail" color="ink" />}
          title="Invitation"
          value="Envoyée"
          chevron={false}
          separator
        />
        <PhoneSettingRow
          leading={<SettingsIcon icon="sliders" color="ink" />}
          title="Modèle"
          value="Multi-départements"
          chevron={false}
        />
      </div>
    </Screen>
  );
}
