import type { ReactNode } from 'react';

import { Banner } from '#components/banner';
import { BottomBar } from '#components/bottom-bar';
import { Button } from '#components/button';
import { CompanyLogo, CompanyPill } from '#components/company-parts';
import { SettingsIcon } from '#components/grouped-list';
import { IconButton } from '#components/icon-button';
import {
  PhoneGroupTitle,
  PhoneNav,
  PhoneSettingRow,
  PhoneStat,
} from '#components/phone-parts';
import { Screen } from '#components/screen';
import { Sheet } from '#components/sheet';
import { Icon } from '#icons';
import { cn } from '#lib/tv';

function More() {
  return (
    <IconButton
      icon="more"
      label="Plus d’actions"
      size="lg"
      iconSize={22}
      className="-mr-0.5 bg-surface"
    />
  );
}

function Identity({
  initials,
  name,
  muted = false,
  status,
}: {
  initials: string;
  name: string;
  muted?: boolean;
  status?: ReactNode;
}) {
  return (
    <div className="mt-3 flex h-14 shrink-0 items-start gap-3">
      <CompanyLogo initials={initials} size={56} muted={muted} />
      <div className="-mt-px">
        <h1 className="text-24 font-bold">{name}</h1>
        {status && <div className="mt-[3px] flex">{status}</div>}
      </div>
    </div>
  );
}

const BANNER_CLASSES = {
  className: 'mt-6 h-[83px] items-start gap-2.5 rounded-[14px] py-0 pr-4 pl-4',
  classNames: {
    icon: 'mt-4',
    title: 'mt-[15px] text-15',
    description: 'mt-0.5 text-13 leading-4',
  },
};

function ScreenTop({ children }: { children: ReactNode }) {
  return (
    <>
      <PhoneNav trailing={<More />} />
      {children}
    </>
  );
}

function AdminRow({
  initials,
  name,
  state,
  chevron = false,
  separator = false,
}: {
  initials: string;
  name: string;
  state: string;
  chevron?: boolean;
  separator?: boolean;
}) {
  return (
    <div className="relative h-16">
      {separator && (
        <div className="absolute -top-px right-0 left-[62px] h-px bg-separator" />
      )}
      <span className="absolute top-[13px] left-3.5 flex size-9 items-center justify-center rounded-full bg-fill-2 text-13 font-semibold">
        {initials}
      </span>
      <p className="absolute top-3 left-[62px] text-16 font-semibold">{name}</p>
      <p className="absolute top-[34px] left-[62px] text-13 text-muted">
        {state}
      </p>
      {chevron && (
        <Icon
          name="chevron"
          size={16}
          className="absolute top-6 right-3.5 text-faint"
        />
      )}
    </div>
  );
}

/** A client on the phone: figures, its admins, the model it runs. */
export function FicheEntrepriseMobile() {
  return (
    <Screen
      tone="fill"
      className="pt-[calc(var(--safe-top)+6px)]"
      bottom={
        <BottomBar surface="plain" className="pt-6 pb-9">
          <Button block variant="secondary" icon="pause" iconSize={20} className="gap-2">
            Suspendre
          </Button>
        </BottomBar>
      }
    >
      <ScreenTop>
        <Identity
          initials="AL"
          name="Atelier Lumen"
          status={<CompanyPill tone="green" label="Active" className="w-[71px]" />}
        />
      </ScreenTop>
      <div className="mt-6 grid grid-cols-2 gap-x-[11px] gap-y-3">
        <PhoneStat size={26} label="Comptes" value="42" />
        <PhoneStat size={26} label="Départements" value="4" />
        <PhoneStat size={26} label="Colis en oct." value="1 284" />
        <PhoneStat size={26} label="Activité" value="5 min" />
      </div>
      <PhoneGroupTitle className="mt-[22px]">Administrateurs</PhoneGroupTitle>
      <div className="mt-1.5 h-[180px] rounded-[14px] bg-surface">
        <AdminRow initials="CB" name="Claire Bonnet" state="Invitation acceptée" />
        <AdminRow
          initials="MO"
          name="Marc Ollier"
          state="Invitation envoyée il y a 2 jours"
          chevron
          separator
        />
        <div className="relative pt-[17px] pl-4 text-16">
          <div className="absolute -top-px right-0 left-[62px] h-px bg-separator" />
          + Inviter un administrateur
        </div>
      </div>
      <PhoneGroupTitle className="mt-[22px]">Fonctionnement</PhoneGroupTitle>
      <div className="mt-1.5 h-[104px] rounded-[14px] bg-surface">
        <PhoneSettingRow
          title="Modèle de départ"
          value="Multi-départements"
          raised
          chevron={false}
          separator
        />
        <PhoneSettingRow title="Étapes modifiées" value="2" chevron={false} />
      </div>
    </Screen>
  );
}

/** The client whose first administrator has not answered yet. */
export function FicheEntrepriseInvitationMobile() {
  return (
    <Screen tone="fill" className="pt-[calc(var(--safe-top)+6px)]">
      <ScreenTop>
        <Identity
          initials="GN"
          name="Groupe Novalis"
          muted
          status={<CompanyPill tone="blue" label="Invitation envoyée" className="w-[140px]" />}
        />
      </ScreenTop>
      <Banner
        tone="grey"
        icon="mail"
        title="En attente de Léo Marchal"
        description="Envoyée lundi à leo.marchal@novalis-groupe.fr. Le lien expire dans 5 jours."
        {...BANNER_CLASSES}
        classNames={{
          ...BANNER_CLASSES.classNames,
          description: cn(BANNER_CLASSES.classNames.description, 'text-ink'),
        }}
      />
      <div className="mt-[25px] h-[104px] rounded-[14px] bg-surface">
        <PhoneSettingRow
          leading={<SettingsIcon icon="send" color="ink" />}
          title="Renvoyer l’invitation"
          chevron
          separator
        />
        <PhoneSettingRow
          leading={<SettingsIcon icon="edit" color="grey" />}
          title={<span className="relative -top-px">Changer l’adresse</span>}
          chevron
        />
      </div>
      <p className="mt-[15px] w-[320px] pl-4 text-13 leading-4 text-muted">
        Aucun chiffre tant que l’administrateur n’a pas créé son mot de passe.
      </p>
    </Screen>
  );
}

/** The client that has been suspended: what it means, and the way back. */
export function FicheEntrepriseSuspendueMobile() {
  return (
    <Screen
      tone="fill"
      className="pt-[calc(var(--safe-top)+6px)]"
      bottom={
        <BottomBar surface="plain" className="pt-6 pb-9">
          <Button block icon="refresh" iconSize={20} className="gap-2">
            Réactiver
          </Button>
        </BottomBar>
      }
    >
      <ScreenTop>
        <Identity
          initials="SK"
          name="Studio Kerval"
          muted
          status={<CompanyPill tone="orange" label="Suspendue" className="w-[100px]" />}
        />
      </ScreenTop>
      <Banner
        tone="orange"
        icon="pause"
        title="Suspendue depuis le 17 octobre"
        description="Plus aucune connexion ni synchronisation. Les données sont gardées."
        {...BANNER_CLASSES}
      />
      <div className="mt-[25px] grid grid-cols-2 gap-x-[11px]">
        <PhoneStat size={26} label="Comptes" value="9" />
        <PhoneStat size={26} label="Départements" value="2" />
      </div>
    </Screen>
  );
}

/** A real company on the phone: the same record, no account name in it (D26). */
export function FicheEntrepriseMountedMobile({
  name,
  initials,
  suspended,
  statusLabel,
  notice,
  stats,
  profile,
  onBack,
  primaryLabel,
  onPrimary,
  error,
  children,
}: {
  name: string;
  initials: string;
  suspended: boolean;
  statusLabel: string;
  notice?: { title: string; description: string };
  stats: { label: string; value: string }[];
  profile: { title: string; value: string }[];
  onBack?: () => void;
  primaryLabel: string;
  onPrimary?: () => void;
  error?: string;
  children?: ReactNode;
}) {
  return (
    <Screen
      tone="fill"
      className="pt-[calc(var(--safe-top)+6px)]"
      bottom={
        <BottomBar surface="plain" className="pt-6 pb-9">
          <Button
            block
            variant={suspended ? 'primary' : 'secondary'}
            icon={suspended ? 'refresh' : 'pause'}
            iconSize={20}
            className="gap-2"
            onClick={onPrimary}
          >
            {primaryLabel}
          </Button>
        </BottomBar>
      }
    >
      <PhoneNav onBack={onBack} />
      <Identity
        initials={initials}
        name={name}
        muted={suspended}
        status={
          <CompanyPill
            tone={suspended ? 'orange' : 'green'}
            label={statusLabel}
          />
        }
      />
      {notice && (
        <Banner
          tone="orange"
          icon="pause"
          title={notice.title}
          description={notice.description}
          {...BANNER_CLASSES}
        />
      )}
      {error && (
        <p role="alert" className="mt-3 text-13 text-red">
          {error}
        </p>
      )}
      <div className="mt-6 grid grid-cols-2 gap-x-[11px] gap-y-3">
        {stats.map((stat) => (
          <PhoneStat key={stat.label} size={26} {...stat} />
        ))}
      </div>
      <PhoneGroupTitle className="mt-[22px]">Fonctionnement</PhoneGroupTitle>
      <div className="mt-1.5 rounded-[14px] bg-surface">
        {profile.map((row, i) => (
          <PhoneSettingRow
            key={row.title}
            title={row.title}
            value={row.value}
            chevron={false}
            separator={i < profile.length - 1}
          />
        ))}
      </div>
      {children}
    </Screen>
  );
}

function BehindSheet() {
  return (
    <Screen tone="fill" className="pt-[calc(var(--safe-top)+6px)]">
      <PhoneNav />
      <Identity initials="AL" name="Atelier Lumen" />
    </Screen>
  );
}

function HomeIndicator() {
  return (
    <span
      aria-hidden="true"
      className="absolute bottom-1 left-[130px] h-[5px] w-[134px] rounded-[3px] bg-ink"
    />
  );
}

function SheetTile({
  tone,
  icon,
}: {
  tone: 'red' | 'orange';
  icon: 'trash' | 'pause';
}) {
  return (
    <span
      className={cn(
        'mt-[3px] mb-4 flex size-[52px] items-center justify-center rounded-full',
        tone === 'red' ? 'bg-red-soft text-red' : 'bg-orange-soft text-orange',
      )}
    >
      <Icon name={icon} size={26} />
    </span>
  );
}

export type SheetAnswerProps = {
  /** The app's sheet lies over its own screen, with no drawn indicator. */
  fixed?: boolean;
  name?: string;
  description?: string;
  pending?: boolean;
  error?: string;
  onCancel?: () => void;
  onConfirm?: () => void;
};

/** Asked on the phone before the company stops working. */
export function SuspendreMobile({
  fixed = false,
  name = 'Atelier Lumen',
  description = '42 comptes ne pourront plus se connecter ni synchroniser. Les données sont gardées.',
  pending = false,
  error,
  onCancel,
  onConfirm,
}: SheetAnswerProps = {}) {
  return (
    <Sheet
      {...(fixed
        ? { fixed: true, onDismiss: onCancel }
        : { behind: <BehindSheet /> })}
      scrimClassName="bg-black/32"
      className={fixed ? 'pb-9' : 'pb-[134px]'}
      title={
        <>
          <SheetTile tone="orange" icon="pause" />
          Suspendre {name} ?
        </>
      }
    >
      <p className="mt-2 text-15 leading-[21px] text-ink-2">{description}</p>
      {error && (
        <p role="alert" className="mt-2 text-13 text-red">
          {error}
        </p>
      )}
      <Button
        block
        className="mt-[46px]"
        disabled={pending}
        onClick={onConfirm}
      >
        Suspendre
      </Button>
      <Button block variant="secondary" className="mt-3" onClick={onCancel}>
        Annuler
      </Button>
      {!fixed && <HomeIndicator />}
    </Sheet>
  );
}

/** Asked on the phone before the company is deleted: the name must be typed. */
export function SupprimerMobile({
  fixed = false,
  name = 'Atelier Lumen',
  description = 'Tout sera effacé sans retour : 42 comptes, 4 départements, l’annuaire et 3 812 colis.',
  typed = 'Atelier Lumen',
  onTyped,
  pending = false,
  error,
  onCancel,
  onConfirm,
}: SheetAnswerProps & {
  typed?: string;
  onTyped?: (value: string) => void;
} = {}) {
  return (
    <Sheet
      {...(fixed
        ? { fixed: true, onDismiss: onCancel }
        : { behind: <BehindSheet /> })}
      scrimClassName="bg-black/32"
      className={fixed ? 'pb-9' : 'pb-[130px]'}
      title={
        <>
          <SheetTile tone="red" icon="trash" />
          Supprimer {name} ?
        </>
      }
    >
      <p className="mt-2 text-15 leading-[21px] text-ink-2">{description}</p>
      <label className="block">
        <span className="mt-[29px] block text-13 font-medium text-muted">
          Tapez « {name} »
        </span>
        {onTyped ? (
          <input
            value={typed}
            onChange={(event) => onTyped(event.target.value)}
            autoComplete="off"
            className="mt-[7px] h-12 w-full rounded-[12px] bg-fill pl-3.5 text-17 shadow-[0_0_0_0.75px_var(--color-ink),inset_0_0_0_0.75px_var(--color-ink)] outline-none"
          />
        ) : (
          <div className="mt-[7px] h-12 rounded-[12px] bg-fill pt-3.5 pl-3.5 text-17 shadow-[0_0_0_0.75px_var(--color-ink),inset_0_0_0_0.75px_var(--color-ink)]">
            {typed}
          </div>
        )}
      </label>
      {error && (
        <p role="alert" className="mt-2 text-13 text-red">
          {error}
        </p>
      )}
      <Button
        block
        variant="danger"
        className="mt-[30px]"
        disabled={typed.trim() !== name || pending}
        onClick={onConfirm}
      >
        Supprimer définitivement
      </Button>
      <Button block variant="secondary" className="mt-3" onClick={onCancel}>
        Annuler
      </Button>
      {!fixed && <HomeIndicator />}
    </Sheet>
  );
}
