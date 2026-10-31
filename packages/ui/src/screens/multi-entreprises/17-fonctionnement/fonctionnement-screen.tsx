import type { ReactNode } from 'react';

import { BottomBar } from '#components/bottom-bar';
import { Button } from '#components/button';
import { CompanySettingsDesk } from '#components/company-parts';
import { DeskChoice } from '#components/desk-form';
import { DeskPanel } from '#components/desk-panel';
import {
  PhoneGroup,
  PhoneGroupTitle,
  PhoneSegments,
  PhoneSettings,
} from '#components/phone-parts';
import { Sheet } from '#components/sheet';
import { Toast } from '#components/toast';
import { companySettingsShell } from '#fixtures/multi-entreprises';
import { Icon, type IconName } from '#icons';
import { cn } from '#lib/tv';

const STATES = ['Désactivée', 'Facultative', 'Obligatoire'];

type Step = {
  title: string;
  description: string;
  chosen: string;
  options?: string[];
  modified?: boolean;
};

function DeskStep({
  step,
  showModified,
  last,
}: {
  step: Step;
  showModified: boolean;
  last: boolean;
}) {
  const modified = showModified && step.modified;
  return (
    <div
      className={cn(
        'relative mx-4 flex items-start justify-between',
        last ? 'h-[55px]' : 'h-14 border-b border-separator',
      )}
    >
      {modified && (
        <span className="absolute top-0 -left-4 h-[55px] w-[3px] bg-ink" />
      )}
      <div className="pt-2.5">
        <p className="relative -top-px text-13 font-semibold">{step.title}</p>
        <p className="mt-[3px] text-12 text-muted">{step.description}</p>
      </div>
      <div className="mt-3.5 flex items-start gap-2">
        {modified && (
          <span className="mt-[3px] flex h-[22px] w-16 items-center justify-center rounded-[4px] bg-fill text-12 font-medium">
            Modifié
          </span>
        )}
        <DeskChoice options={step.options ?? STATES} value={step.chosen} />
      </div>
    </div>
  );
}

const HANDOVER_STEPS: Step[] = [
  {
    title: 'Preuve par QR ou code',
    description: 'Le salarié présente le QR ou le code de son e-mail',
    chosen: 'Obligatoire',
  },
  {
    title: 'Scan du colis',
    description: 'Chaque colis remis est scanné',
    chosen: 'Facultative',
  },
  {
    title: 'Signature',
    description: 'Le salarié signe sur l’écran',
    chosen: 'Obligatoire',
    modified: true,
  },
  {
    title: 'Photo',
    description: 'Photo du colis remis',
    chosen: 'Désactivée',
  },
  {
    title: 'Retrait par un collègue',
    description: 'Un collègue peut retirer à la place du salarié',
    chosen: 'Facultative',
  },
];

const SECTIONS: { title: string; steps: Step[] }[] = [
  {
    title: 'Réception',
    steps: [
      {
        title: 'Revue du lot',
        description: 'Revoir les cas douteux avant d’enregistrer le lot',
        chosen: 'Facultative',
      },
    ],
  },
  {
    title: 'Dépôt',
    steps: [
      {
        title: 'Navette = département',
        description: 'Elle remet elle-même les colis aux salariés',
        chosen: 'Non',
        options: ['Non', 'Oui'],
      },
      {
        title: 'Confirmation du dépôt',
        description: 'Le département confirme ce qu’il reçoit',
        chosen: 'Au nombre',
        options: ['Désactivée', 'Au nombre', 'Colis par colis'],
      },
    ],
  },
  {
    title: 'Remise',
    steps: HANDOVER_STEPS,
  },
  {
    title: 'E-mails',
    steps: [
      {
        title: 'Moment de l’e-mail',
        description: 'Quand le salarié est prévenu',
        chosen: 'Au scan',
        options: ['Au scan', 'Au dépôt'],
        modified: true,
      },
      {
        title: 'Relances',
        description: 'Rappels au salarié qui ne vient pas',
        chosen: 'J+2 et J+5',
        options: ['Aucune', 'J+2', 'J+2 et J+5'],
      },
    ],
  },
];

function OperationDesk({
  showModified,
  aside,
  overlay,
  footer,
}: {
  showModified: boolean;
  aside: ReactNode;
  overlay?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <CompanySettingsDesk
      tab="operation"
      shell={companySettingsShell('Fonctionnement')}
      overlay={overlay}
    >
      <p className="relative -top-px mt-[19px] h-4 text-13 text-muted">
        Modèle de départ : Multi-départements · 2 étapes changées depuis
      </p>
      <div className="mt-3 flex h-[600px] shrink-0 items-start gap-4 overflow-y-auto [scrollbar-width:none]">
        <div className="flex w-[760px] shrink-0 flex-col gap-4">
          {SECTIONS.map((section) => (
            <DeskPanel overlayStroke key={section.title} title={section.title}>
              {section.steps.map((step, i) => (
                <DeskStep
                  key={step.title}
                  step={step}
                  showModified={showModified}
                  last={i === section.steps.length - 1}
                />
              ))}
            </DeskPanel>
          ))}
        </div>
        {aside}
      </div>
      {footer}
    </CompanySettingsDesk>
  );
}

const STATE_HELP = [
  ['Désactivée', 'L’étape n’apparaît pas.'],
  ['Facultative', 'Proposée, on peut passer.'],
  ['Obligatoire', 'Le colis ne peut pas avancer sans elle.'],
] as const;

function StateHelp() {
  return (
    <DeskPanel overlayStroke title="Ce que règle chaque état" className="h-[236px] w-[376px]">
      <div className="mt-[15px] flex flex-col gap-[17px] px-4">
        {STATE_HELP.map(([title, text]) => (
          <div key={title} className="h-[35px]">
            <p className="relative -top-px text-13 font-semibold">{title}</p>
            <p className="mt-[3px] text-12 text-muted">{text}</p>
          </div>
        ))}
      </div>
    </DeskPanel>
  );
}

/** The steps with two unsaved changes, and the bar that saves them. */
export function FonctionnementModificationsDesktop() {
  return (
    <OperationDesk
      showModified
      aside={<StateHelp />}
      footer={
        <div className="absolute inset-x-0 bottom-0 flex h-16 items-start border-t border-separator bg-surface px-8 pt-[15px]">
          <span className="mt-3 size-2 rounded-full bg-blue-solid" />
          <p className="mt-1.5 ml-2 flex-1 text-13 font-semibold">
            2 changements non enregistrés
          </p>
          <Button variant="outline" size="desk" className="w-[84px]">
            Annuler
          </Button>
          <Button size="desk" className="ml-2 w-[140px]">
            Enregistrer…
          </Button>
        </div>
      }
    />
  );
}

function ImpactLine({
  icon,
  title,
  change,
  impact,
  className,
}: {
  icon: IconName;
  title: string;
  change: string;
  impact: string;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start gap-3 px-6', className)}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-desk bg-fill">
        <Icon name={icon} size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="relative -top-px text-14 font-semibold">{title}</p>
        <p className="relative -top-px mt-[3px] text-13 text-ink-2">{change}</p>
        <p className="mt-2 flex h-10 items-start gap-2 rounded-[6px] bg-orange-soft pt-3 pl-2.5 text-13 text-orange-strong">
          <Icon name="info" size={16} className="shrink-0" />
          <span className="-mt-[2px]">{impact}</span>
        </p>
      </div>
    </div>
  );
}

/** The confirmation that shows which parcels on their way the change will touch. */
export function ColisTouchesDesktop() {
  return (
    <OperationDesk
      showModified
      aside={null}
      overlay={
        <div className="absolute inset-0 bg-black/32">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="applied-title"
            className="absolute top-[200px] left-[440px] h-[440px] w-[560px] rounded-desk bg-surface shadow-[0_16px_48px_rgb(0_0_0/0.2)]"
          >
            <div className="h-[93px] border-b border-separator px-6 pt-[22px]">
              <h2 id="applied-title" className="text-18 font-bold">
                Appliquer à 26 colis en cours ?
              </h2>
              <p className="relative -top-px mt-1.5 text-13 text-muted">
                Le changement vaut tout de suite pour tous les colis, y compris
                ceux déjà en route ou prêts.
              </p>
            </div>
            <ImpactLine
              icon="sign"
              title="Signature"
              change="Facultative → Obligatoire"
              impact="12 colis prêts devront être signés à la remise."
              className="mt-[15px]"
            />
            <ImpactLine
              icon="mail"
              title="Moment de l’e-mail"
              change="Au dépôt → Au scan"
              impact="14 colis en route : les salariés seront prévenus maintenant, avant le dépôt."
              className="mt-5"
            />
            <div className="absolute inset-x-0 bottom-0 flex h-20 justify-end gap-2 border-t border-separator px-6 pt-[23px]">
              <Button variant="outline" size="desk" className="w-[84px]">
                Revoir
              </Button>
              <Button size="desk" className="w-[180px]">
                Appliquer à 26 colis
              </Button>
            </div>
          </div>
        </div>
      }
    />
  );
}

const HISTORY = [
  {
    when: 'Aujourd’hui, 11:04',
    what: 'Signature obligatoire, e-mail au scan · 26 colis',
    who: 'Claire Bonnet',
  },
  { when: '21 oct., 14:10', what: 'Relances J+2 et J+5', who: 'Claire Bonnet' },
  { when: '3 sept., 10:15', what: 'Modèle Multi-départements', who: 'Plateforme' },
];

/** The saved state: the history of the changes and the toast that can undo. */
export function FonctionnementEnregistreDesktop() {
  return (
    <OperationDesk
      showModified={false}
      aside={
        <DeskPanel overlayStroke title="Historique" className="h-[300px] w-[376px]">
          <div className="mt-[15px] flex flex-col gap-6 px-4">
            {HISTORY.map((entry) => (
              <div key={entry.when} className="h-[52px]">
                <p className="text-12 text-muted">{entry.when}</p>
                <p className="relative -top-px mt-1 text-13 font-medium">
                  {entry.what}
                </p>
                <p className="mt-1 text-12 text-muted">{entry.who}</p>
              </div>
            ))}
          </div>
        </DeskPanel>
      }
      footer={
        <Toast
          message={
            <span className="flex items-center gap-2.5">
              <Icon name="check" size={18} className="shrink-0 text-ios-green" />
              <span className="-mt-[4.4px]">Enregistré · appliqué à 26 colis</span>
            </span>
          }
          actionLabel="Annuler"
          className="absolute right-8 bottom-8 w-[360px] rounded-desk pr-[23px] pl-4 text-13 [&>button]:-mt-[4.4px] [&>button]:text-white"
        />
      }
    />
  );
}

function PhoneSteps({ showModified }: { showModified: boolean }) {
  return (
    <>
      <PhoneGroupTitle className="mt-4">Remise</PhoneGroupTitle>
      <PhoneGroup className="relative mt-1.5 h-[590px]">
        {HANDOVER_STEPS.map((step, i) => (
          <div
            key={step.title}
            className="absolute inset-x-4"
            style={{ top: 14 + i * 118 }}
          >
            <p className="text-16 font-semibold">{step.title}</p>
            <p className="relative -top-px mt-1 text-13 text-muted">
              {step.description}
            </p>
            <PhoneSegments
              options={STATES}
              value={step.chosen}
              label={step.title}
              className="mt-[7px] h-11 w-[321px] rounded-full"
              optionClassName="h-10 rounded-full pb-[3px] text-14"
            />
            {i < HANDOVER_STEPS.length - 1 && (
              <span className="absolute inset-x-0 top-[103px] h-px bg-separator" />
            )}
            {showModified && step.modified && (
              <span className="absolute top-[-2px] right-0 flex h-[22px] w-[61px] items-center justify-center rounded-full bg-fill text-12 font-semibold">
                Modifié
              </span>
            )}
          </div>
        ))}
      </PhoneGroup>
    </>
  );
}

/** The steps of the handover on the phone, with what is left to save. */
export function FonctionnementMobile() {
  return (
    <PhoneSettings
      title="Fonctionnement"
      bottom={
        <BottomBar surface="line" className="pt-[23px] pb-9">
          <Button block>Enregistrer 2 changements</Button>
        </BottomBar>
      }
    >
      <PhoneSteps showModified />
    </PhoneSettings>
  );
}

/** Saved on the phone: the toast takes the place of the bar. */
export function FonctionnementEnregistreMobile() {
  return (
    <PhoneSettings title="Fonctionnement">
      <PhoneSteps showModified={false} />
      <Toast
        message="Appliqué à 26 colis"
        actionLabel="Annuler"
        className="mt-3 w-full rounded-[14px] px-4 [&>button]:-mt-0.5 [&>button]:text-white [&>span]:-mt-0.5"
      />
    </PhoneSettings>
  );
}

function ImpactRow({
  icon,
  title,
  text,
  separator = false,
}: {
  icon: IconName;
  title: string;
  text: string;
  separator?: boolean;
}) {
  return (
    <div className="relative h-[68px] text-ink">
      <span className="absolute top-3.5 left-0 flex size-10 items-center justify-center rounded-full bg-orange-soft text-orange-strong">
        <Icon name={icon} size={20} />
      </span>
      <p className="absolute top-[11px] left-[52px] text-17 font-semibold">
        {title}
      </p>
      <p className="absolute top-[33px] left-[52px] text-14 text-muted">{text}</p>
      {separator && (
        <span className="absolute right-0 bottom-0 left-[52px] h-px bg-separator" />
      )}
    </div>
  );
}

/** The confirmation on the phone, a sheet over the empty page. */
export function ColisTouchesMobile() {
  return (
    <Sheet
      title="Appliquer à 26 colis ?"
      description="Le changement vaut tout de suite pour tous les colis."
      behind={<PhoneSettings title="Fonctionnement" />}
      scrimClassName="bg-black/32"
      descriptionClassName="mt-1.5"
      className="relative h-[552px] rounded-t-[24px] [&_h2]:mt-[19px] [&>div>span]:w-9 [&>div>span]:bg-faint"
    >
      <div className="mt-[22px]">
        <ImpactRow
          icon="sign"
          title="Signature obligatoire"
          text="12 colis prêts devront être signés"
          separator
        />
        <ImpactRow
          icon="mail"
          title="E-mail au scan"
          text="14 salariés prévenus maintenant"
        />
      </div>
      <Button block className="mt-[30px]">
        Appliquer à 26 colis
      </Button>
      <Button block variant="secondary" className="mt-3">
        Revoir
      </Button>
      <span
        aria-hidden="true"
        className="absolute top-[543px] left-[130px] h-[5px] w-[134px] rounded-full bg-ink"
      />
    </Sheet>
  );
}
