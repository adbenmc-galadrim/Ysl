import type { ReactNode } from 'react';

import { Button } from '#components/button';
import { CompanyShell, DeskPageHeader } from '#components/company-shell';
import { DeskChoice, DeskField } from '#components/desk-form';
import { DeskPanel } from '#components/desk-panel';
import { ACCOUNT, COMPANY, crumbs, PLATFORM_NAV } from '#fixtures/multi-entreprises';
import { Icon } from '#icons';
import { cn } from '#lib/tv';
import type { PlatformChrome } from '#screens/multi-entreprises/03-accueil/entreprises-screen';
import {
  STEP_GROUPS,
  type WizardStepGroup,
} from '#screens/multi-entreprises/04-nouvelle-entreprise/steps';

const STEPS = [
  { label: 'Modèle', width: 90.4 },
  { label: 'Fonctionnement', width: 149.6 },
  { label: 'Administrateur' },
];

function Stepper({ current, total }: { current: number; total: number }) {
  return (
    <ol className="mt-[17px] flex h-[22px] shrink-0 items-start">
      {STEPS.slice(0, total).map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={step.label} className="flex items-start">
            <span
              className="flex items-start"
              style={{ width: step.width }}
            >
              <span
                className={cn(
                  'flex size-[22px] items-center justify-center rounded-full text-12 font-semibold',
                  done || active
                    ? 'bg-ink text-on-ink'
                    : 'border border-border text-muted',
                )}
              >
                {done ? <Icon name="tick" size={12} className="mt-px" /> : i + 1}
              </span>
              <span
                className={cn(
                  'mt-[3px] ml-2 text-13 whitespace-nowrap',
                  active && 'font-semibold',
                  !done && !active && 'text-muted',
                )}
              >
                {step.label}
              </span>
            </span>
            {i < total - 1 && (
              <span className="mt-[11px] mr-4 h-px w-8 bg-border" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Footer({ note, children }: { note: string; children: ReactNode }) {
  return (
    <div className="absolute right-0 bottom-0 left-[224px] flex h-16 items-start justify-between border-t border-separator bg-surface pt-[13px] pr-8 pl-8">
      <p className="mt-2 text-13 text-muted">{note}</p>
      <div className="flex gap-2">{children}</div>
    </div>
  );
}

function WizardShell({
  current,
  footer,
  chrome,
  totalSteps = STEPS.length,
  children,
}: {
  current: number;
  footer: ReactNode;
  chrome?: PlatformChrome;
  /** The app stops before the last step until the invitation exists. */
  totalSteps?: number;
  children: ReactNode;
}) {
  return (
    <CompanyShell
      company={COMPANY.platform}
      nav={PLATFORM_NAV}
      active="entreprises"
      account={ACCOUNT.platform}
      breadcrumb={crumbs('Plateforme', 'Entreprises', 'Nouvelle entreprise')}
      overlay={footer}
      {...chrome}
    >
      <DeskPageHeader title="Nouvelle entreprise" />
      <Stepper current={current} total={totalSteps} />
      <div className="mt-[18px] h-px shrink-0 bg-separator" />
      {children}
    </CompanyShell>
  );
}

export type ProfileModelCard = {
  id?: string;
  name: string;
  description: string;
  selected?: boolean;
  features: { text: string; on: boolean }[];
};

const MODELS: ProfileModelCard[] = [
  {
    name: 'Petit site, la navette remet',
    description: 'Un seul lieu de retrait : la navette scanne et remet elle-même.',
    features: [
      { text: 'La navette fait office de département', on: true },
      { text: 'Pas de confirmation de dépôt', on: false },
      { text: 'E-mail dès le scan', on: true },
      { text: 'Relance à J+2', on: true },
    ],
  },
  {
    name: 'Multi-départements',
    description: 'Plusieurs départements, chacun avec son point de réception.',
    selected: true,
    features: [
      { text: 'Dépôt confirmé au nombre', on: true },
      { text: 'E-mail au dépôt', on: true },
      { text: 'QR ou code obligatoire', on: true },
      { text: 'Relances J+2 et J+5', on: true },
    ],
  },
  {
    name: 'Traçabilité stricte',
    description: 'Chaque geste est prouvé, du dépôt à la remise.',
    features: [
      { text: 'Dépôt colis par colis', on: true },
      { text: 'Scan et signature obligatoires', on: true },
      { text: 'Photo facultative', on: true },
      { text: 'Pas de retrait par un collègue', on: false },
    ],
  },
];

/** Step 1 on the computer: the company's name and the model it starts from. */
export function NouvelleEntrepriseModeleDesktop({
  chrome,
  totalSteps,
  name,
  onName,
  models = MODELS,
  onSelectModel,
  note = 'Étape 1 sur 3',
  confirmLabel = 'Continuer',
  confirmDisabled = false,
  onConfirm,
  onCancel,
  error,
}: {
  chrome?: PlatformChrome;
  totalSteps?: number;
  name?: string;
  onName?: (name: string) => void;
  models?: ProfileModelCard[];
  onSelectModel?: (id: string) => void;
  note?: string;
  confirmLabel?: string;
  confirmDisabled?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
  error?: string;
} = {}) {
  return (
    <WizardShell
      current={0}
      chrome={chrome}
      totalSteps={totalSteps}
      footer={
        <Footer note={note}>
          <Button
            variant="outline"
            size="desk"
            className="h-9 w-[82.4px]"
            onClick={onCancel}
          >
            Annuler
          </Button>
          <Button
            size="desk"
            className="h-9 w-[120px]"
            disabled={confirmDisabled}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </Footer>
      }
    >
      <div className="relative h-[88px] shrink-0 border-b border-separator">
        <p className="absolute top-[31px] text-13 font-semibold">
          Nom de l’entreprise
        </p>
        <p className="absolute top-[52px] text-12 text-muted">
          Affiché aux salariés et dans les e-mails
        </p>
        {onName ? (
          <input
            aria-label="Nom de l’entreprise"
            value={name ?? ''}
            onChange={(event) => onName(event.target.value)}
            maxLength={80}
            className="absolute top-[23px] left-[280px] h-9 w-[420px] rounded-[6px] pl-3 text-14 shadow-[0_0_0_0.75px_var(--color-ink),inset_0_0_0_0.75px_var(--color-ink)] outline-none"
          />
        ) : (
          <div className="absolute top-[23px] left-[280px] flex h-9 w-[420px] items-start rounded-[6px] pt-[9px] pl-3 text-14 shadow-[0_0_0_0.75px_var(--color-ink),inset_0_0_0_0.75px_var(--color-ink)]">
            Atelier Lumen
          </div>
        )}
        {error && (
          <p role="alert" className="absolute top-[63px] left-[280px] text-12 text-red">
            {error}
          </p>
        )}
      </div>
      <h2 className="mt-6 text-15 font-semibold">
        Modèle de fonctionnement
      </h2>
      <p className="mt-[5px] text-13 text-muted">
        Un point de départ : chaque étape s’ajuste à l’étape suivante, et
        l’entreprise peut tout changer ensuite.
      </p>
      <div className="mt-[21px] flex shrink-0 gap-[15px]">
        {models.map((model) => (
          <div
            key={model.name}
            role="radio"
            aria-checked={Boolean(model.selected)}
            tabIndex={onSelectModel ? 0 : undefined}
            onClick={() => model.id && onSelectModel?.(model.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                if (model.id) onSelectModel?.(model.id);
              }
            }}
            className={cn(
              'relative h-[236px] w-[374px] rounded-desk',
              onSelectModel && 'cursor-pointer',
              model.selected
                ? 'shadow-[0_0_0_1px_var(--color-ink),inset_0_0_0_1px_var(--color-ink)]'
                : 'shadow-[0_0_0_0.5px_var(--color-border),inset_0_0_0_0.5px_var(--color-border)]',
            )}
          >
            <span
              className={cn(
                'absolute top-[18px] left-4 flex size-5 items-center justify-center rounded-full',
                model.selected
                  ? 'bg-ink'
                  : 'shadow-[inset_0_0_0_1.5px_var(--color-border)]',
              )}
            >
              {model.selected && (
                <span className="size-2 rounded-full bg-white" />
              )}
            </span>
            <h3 className="absolute top-4 left-12 text-15 font-semibold">
              {model.name}
            </h3>
            <p className="absolute top-[39px] left-12 w-[310px] text-13 leading-4 text-muted">
              {model.description}
            </p>
            <div className="absolute top-24 right-4 left-4 h-px bg-separator" />
            <ul className="absolute top-[110px] left-4 flex flex-col gap-3">
              {model.features.map((feature) => (
                <li
                  key={feature.text}
                  className={cn(
                    'flex h-4 text-13',
                    !feature.on && 'text-muted',
                  )}
                >
                  <Icon
                    name={feature.on ? 'tick' : 'x'}
                    size={14}
                    className="mt-[3px] mr-2.5"
                  />
                  {feature.text}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </WizardShell>
  );
}

/** Step 2 on the computer: each step of the model, and what was changed. */
export function NouvelleEntrepriseFonctionnementDesktop({
  chrome,
  totalSteps,
  groups = STEP_GROUPS,
  summary = 'Modèle « Multi-départements » · 1 étape modifiée',
  notice,
  note = 'Étape 2 sur 3 · l’entreprise pourra tout modifier ensuite',
  onChoose,
  onRevert,
  hideRevert = false,
  onBack,
  confirmLabel = 'Continuer',
  confirmDisabled = false,
  onConfirm,
}: {
  chrome?: PlatformChrome;
  totalSteps?: number;
  groups?: WizardStepGroup[];
  summary?: string;
  notice?: string;
  note?: string;
  onChoose?: (step: string, value: string) => void;
  onRevert?: () => void;
  hideRevert?: boolean;
  onBack?: () => void;
  confirmLabel?: string;
  confirmDisabled?: boolean;
  onConfirm?: () => void;
} = {}) {
  return (
    <WizardShell
      current={1}
      chrome={chrome}
      totalSteps={totalSteps}
      footer={
        <Footer note={note}>
          <Button
            variant="outline"
            size="desk"
            className="h-9 w-[75.2px]"
            onClick={onBack}
          >
            Retour
          </Button>
          <Button
            size="desk"
            className="h-9 w-[120px]"
            disabled={confirmDisabled}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </Footer>
      }
    >
      <div className="mt-[19px] flex h-8 shrink-0 items-start justify-between">
        <p className="mt-1.5 text-13 text-muted">{summary}</p>
        {!hideRevert && (
          <Button
            size="desk"
            variant="secondary"
            icon="undo"
            className="relative top-[1.5px] left-px w-[150px] justify-start bg-transparent text-ink-2"
            onClick={onRevert}
          >
            Revenir au modèle
          </Button>
        )}
      </div>
      {notice && <p className="mt-2 shrink-0 text-13 text-orange-strong">{notice}</p>}
      <div className="mt-2 flex shrink-0 flex-col gap-4">
        {groups.map((group) => (
          <DeskPanel key={group.title} title={group.title}>
            {group.steps.map((step, i) => (
              <div
                key={step.title}
                className={cn(
                  'relative flex h-14 items-start justify-between last:h-[54px]',
                  i < group.steps.length - 1 && 'mx-[15px] border-b border-separator',
                  i === group.steps.length - 1 && 'mx-[15px]',
                )}
              >
                {step.modified && (
                  <span className="absolute top-0 -left-4 h-[55px] w-[3px] bg-ink" />
                )}
                <div className="mt-2.5">
                  <p className="text-13 font-semibold">{step.title}</p>
                  <p className="mt-1 text-12 text-muted">{step.hint}</p>
                </div>
                <div className="mt-[15px] flex items-start gap-2">
                  {step.modified && (
                    <span className="mt-[3px] flex h-[22px] w-16 items-start justify-center rounded-[4px] bg-fill pt-[3px] text-12 font-medium">
                      Modifié
                    </span>
                  )}
                  <DeskChoice
                    options={step.options}
                    value={step.value}
                    label={step.title}
                    onChange={
                      step.id
                        ? (value) => onChoose?.(step.id as string, value)
                        : undefined
                    }
                  />
                </div>
              </div>
            ))}
          </DeskPanel>
        ))}
      </div>
      {/* The footer floats over the page: the last row must scroll out from under it. */}
      <div aria-hidden className="h-20 shrink-0" />
    </WizardShell>
  );
}

function InvitationPreview() {
  return (
    <DeskPanel
      title="Aperçu de l’invitation"
      subtitle="De : Courrier · invitation@courrier.app"
      className="h-[487px]"
    >
      <div className="flex-1 rounded-b-desk bg-fill px-10 pt-7">
        <div className="relative h-[371px] rounded-desk bg-surface px-8 pt-[31px]">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-[8px] bg-ink text-14 font-bold text-on-ink">
              AL
            </span>
            <span className="text-15 font-semibold">Atelier Lumen</span>
          </div>
          <h3 className="mt-[29px] text-26 font-bold">Bienvenue, Claire</h3>
          <p className="mt-3 text-14 leading-[17px] text-ink-2">
            Atelier Lumen utilise Courrier pour suivre ses colis. Vous en êtes
            l’administratrice : créez votre mot de passe pour commencer.
          </p>
          <p className="mt-6 flex h-11 w-[220px] items-center pb-0.5 justify-center rounded-[8px] bg-ink text-14 font-semibold text-on-ink">
            Créer mon mot de passe
          </p>
          <p className="mt-[17px] text-12 text-muted">
            Ce lien est valable 7 jours et ne sert qu’une fois.
          </p>
          <div className="mt-5 h-px bg-separator" />
          <p className="mt-[17px] text-12 leading-[14px] text-muted">
            Envoyé par Courrier pour Atelier Lumen. Une question ? Répondez à
            cet e-mail : il arrive à votre interlocuteur Courrier.
          </p>
        </div>
      </div>
    </DeskPanel>
  );
}

/** Step 3 on the computer: the first administrator and the e-mail they will get. */
export function NouvelleEntrepriseAdministrateurDesktop() {
  return (
    <WizardShell
      current={2}
      footer={
        <Footer note="Étape 3 sur 3">
          <Button variant="outline" size="desk" className="h-9 w-[75.2px]">
            Retour
          </Button>
          <Button
            size="desk"
            icon="send"
            className="h-9 w-[254.8px] justify-start"
          >
            Créer et envoyer l’invitation
          </Button>
        </Footer>
      }
    >
      <div className="mt-6 flex shrink-0 gap-8">
        <div className="w-[560px] shrink-0">
          <h2 className="text-15 font-semibold">Premier administrateur</h2>
          <p className="mt-[3px] text-13 text-muted">
            Il gère ensuite comptes, départements, annuaire et fonctionnement.
          </p>
          <DeskField
            label="Prénom et nom"
            value="Claire Bonnet"
            className="mt-[22px]"
            labelClassName="top-0"
            boxClassName="shadow-[inset_0_0_0_1px_var(--color-border)]"
            inputClassName="pb-px"
          />
          <DeskField
            label="E-mail professionnel"
            value="claire.bonnet@atelier-lumen.fr"
            focused
            className="mt-4"
            labelClassName="top-0"
            inputClassName="pb-px"
          />
          <p className="mt-[7px] text-12 text-muted">
            Elle recevra un lien valable 7 jours.
          </p>
          <DeskPanel title={<span className="relative top-px">Récapitulatif</span>} className="mt-[31px] h-[156px]">
            <dl className="mt-[15px] flex flex-col gap-3.5 px-[15px] text-13">
              {[
                ['Entreprise', 'Atelier Lumen'],
                ['Modèle', 'Multi-départements, 1 étape modifiée'],
                ['Expéditeur', 'Domaine de la plateforme, à changer'],
              ].map(([label, value]) => (
                <div key={label} className="flex">
                  <dt className="w-[130px] text-muted">{label}</dt>
                  <dd className="font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </DeskPanel>
        </div>
        <div className="w-[560px] shrink-0">
          <InvitationPreview />
        </div>
      </div>
    </WizardShell>
  );
}

export type { WizardStepGroup } from '#screens/multi-entreprises/04-nouvelle-entreprise/steps';
