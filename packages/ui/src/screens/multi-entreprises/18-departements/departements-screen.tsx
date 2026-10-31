import { Button } from '#components/button';
import { CompanyShell, DeskPageHeader } from '#components/company-shell';
import { DeskFormRow, DeskInput, DeskSectionTitle } from '#components/desk-form';
import { DeskPanel } from '#components/desk-panel';
import { DeskTable, type DeskTableColumn } from '#components/desk-table';
import { DeskTabs } from '#components/desk-tabs';
import { IconTile } from '#components/icon-tile';
import { ListRow } from '#components/list-row';
import { NavBarAction } from '#components/nav-bar';
import {
  PhoneBarButton,
  PhoneGroup,
  PhoneSettingRow,
  PhoneSettings,
} from '#components/phone-parts';
import { QrCode } from '#components/qr-code';
import {
  ACCOUNT,
  COMPANY,
  COMPANY_ADMIN_NAV,
  crumbs,
  type Department,
  DEPARTMENTS,
} from '#fixtures/multi-entreprises';
import { Icon } from '#icons';
import { cn } from '#lib/tv';

const DEPARTMENT_QR = [
  '#######.###.#.#######',
  '#.....#.##....#.....#',
  '#.###.#.#.#...#.###.#',
  '#.###.#.##.#..#.###.#',
  '#.###.#...#...#.###.#',
  '#.....#.#.#...#.....#',
  '#######.###...#######',
  '........#..##........',
  '###...#.#.##.#..##...',
  '#.#.##.#..##..######.',
  '..##.#.######..##..#.',
  '.#...#.#.##.#..###...',
  '...#..#.....##..##.##',
  '..........#.##..##..#',
  '#######...##.##.....#',
  '#.....#..##..#.....##',
  '#.###.#...###.....#.#',
  '#.###.#.##....#####..',
  '#.###.#..#..##......#',
  '#.....#...##.#.#..#.#',
  '#######.#..#..#.#.#.#',
];

function DepartmentQr({ size, className }: { size: number; className?: string }) {
  return (
    <QrCode
      matrix={DEPARTMENT_QR}
      module={size / DEPARTMENT_QR.length}
      label="Code DEP-STU-7Q4"
      className={cn('rounded-none p-0', className)}
    />
  );
}

const count = (width: number) =>
  function CountCell({ value }: { value: string | number }) {
    return (
      <span className="text-right" style={{ width }}>
        {value}
      </span>
    );
  };

const AccountsCount = count(65);
const PresentCount = count(75);
const ComingCount = count(66);

const COLUMNS: DeskTableColumn<Department>[] = [
  {
    key: 'name',
    header: 'Département',
    width: 190,
    cell: (d) => <span className="font-semibold">{d.name}</span>,
  },
  {
    key: 'place',
    header: 'Point de réception',
    width: 250,
    cell: (d) => <span className="text-ink-2">{d.place}</span>,
  },
  {
    key: 'hours',
    header: 'Horaires',
    width: 290,
    cell: (d) => <span className="text-ink-2">{d.hours}</span>,
  },
  {
    key: 'accounts',
    header: 'Comptes',
    width: 90,
    cell: (d) => <AccountsCount value={d.accounts} />,
  },
  {
    key: 'present',
    header: 'Présents',
    width: 100,
    cell: (d) => <PresentCount value={d.present} />,
  },
  {
    key: 'coming',
    header: 'À venir',
    width: 90,
    cell: (d) => <ComingCount value={d.coming} />,
  },
  {
    key: 'qr',
    header: 'QR',
    cell: () => (
      <Icon name="qr" size={16} className="mt-[2.5px] text-muted" />
    ),
  },
];

/** The company's departments on the computer, with a QR to print for each. */
export function DepartementsDesktop() {
  return (
    <CompanyShell
      company={COMPANY.admin}
      nav={COMPANY_ADMIN_NAV}
      active="departements"
      account={ACCOUNT.companyAdmin}
      breadcrumb={crumbs('Atelier Lumen', 'Départements')}
    >
      <DeskPageHeader
        title="Départements"
        subtitle="4 départements · 31 comptes"
        actions={
          <>
            <Button
              variant="outline"
              size="desk"
              icon="printer"
              className="w-[142px] justify-start"
            >
              Imprimer les QR
            </Button>
            <Button size="desk" icon="plus" className="w-[172px] justify-start">
              Nouveau département
            </Button>
          </>
        }
      />
      <DeskTable
        label="Départements"
        className="mt-[16.4px] shrink-0"
        columns={COLUMNS}
        rows={DEPARTMENTS}
        rowKey={(d) => d.id}
        activeRow="studio"
      />
      <p className="mt-[29px] text-12 text-muted">
        Le service courrier reçoit les colis des transporteurs ; ses comptes sont
        les navettes. Il peut aussi remettre, si le profil le permet.
      </p>
    </CompanyShell>
  );
}

const WEEK = [
  { day: 'Lundi', slots: ['9:00–12:30', '14:00–18:00'] },
  { day: 'Mardi', slots: ['9:00–12:30', '14:00–18:00'] },
  { day: 'Mercredi', slots: ['9:00–12:30', '14:00–18:00'] },
  { day: 'Jeudi', slots: ['9:00–12:30', '14:00–18:00'] },
  { day: 'Vendredi', slots: ['9:00–12:30', '14:00–17:00'] },
  { day: 'Samedi', slots: [] },
];

function DeskSwitch({ checked, label }: { checked: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={cn(
        'mt-1.5 flex h-5 w-8 shrink-0 cursor-pointer rounded-full p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-blue',
        checked ? 'justify-end bg-ios-green' : 'bg-fill-2',
      )}
    >
      <span className="size-4 rounded-full bg-white" />
    </button>
  );
}

/** One department's settings: where and when parcels are collected, and its QR. */
export function FicheDepartementDesktop() {
  return (
    <CompanyShell
      company={COMPANY.admin}
      nav={COMPANY_ADMIN_NAV}
      active="departements"
      account={ACCOUNT.companyAdmin}
      breadcrumb={crumbs('Atelier Lumen', 'Départements', 'Studio')}
    >
      <DeskPageHeader
        title="Studio"
        subtitle="12 comptes · 12 colis présents, 6 à venir"
        actions={
          <Button size="desk" className="w-[110px]">
            Enregistrer
          </Button>
        }
      />
      <DeskTabs
        label="Fiche du département"
        active="reglages"
        className="mt-[12.4px] shrink-0"
        tabs={[
          { id: 'reglages', label: 'Réglages', width: 59 },
          { id: 'comptes', label: 'Comptes 12', width: 72 },
          { id: 'annuaire', label: 'Annuaire 84', width: 73 },
          { id: 'colis', label: 'Colis' },
        ]}
      />
      <div className="mt-[19px] flex items-start gap-4">
        <div className="w-[800px] shrink-0">
          <DeskSectionTitle
            title="Point de réception"
            description="Repris dans l’avis de retrait envoyé aux salariés."
          />
          <DeskFormRow label="Nom" className="mt-3.5">
            <DeskInput label="Nom" className="w-[420px]" defaultValue="Studio" />
          </DeskFormRow>
          <DeskFormRow
            label="Lieu"
            hint="Où le salarié vient chercher son colis"
            className="mt-3 h-8"
          >
            <DeskInput
              label="Lieu"
              className="w-[420px]"
              defaultValue="Bât. A, 2e étage, accueil"
            />
          </DeskFormRow>
          <DeskFormRow label="Consignes" hint="Facultatif" className="mt-6">
            <textarea
              aria-label="Consignes"
              defaultValue="Sonnez si l’accueil est fermé."
              className="h-14 w-[420px] resize-none rounded-[6px] bg-surface px-2.5 pt-5 text-13 shadow-[0_0_0_0.5px_var(--color-border),inset_0_0_0_0.5px_var(--color-border)] outline-none focus-visible:ring-2 focus-visible:ring-blue"
            />
          </DeskFormRow>
          <div className="mt-5 h-px bg-separator" />
          <DeskSectionTitle className="mt-[19px]" title="Horaires de retrait" />
          <div className="mt-[18px] flex flex-col gap-2">
            {WEEK.map(({ day, slots }) => (
              <div key={day} className="flex h-8 items-start">
                <p className="relative -top-px w-[124px] pt-[7px] text-13 font-medium">
                  {day}
                </p>
                <DeskSwitch checked={slots.length > 0} label={day} />
                {slots.length > 0 ? (
                  <div className="ml-4 flex gap-3">
                    {slots.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        className="h-8 w-[120px] cursor-pointer rounded-[6px] pb-[3px] text-13 shadow-[0_0_0_0.5px_var(--color-border),inset_0_0_0_0.5px_var(--color-border)] outline-none focus-visible:ring-2 focus-visible:ring-blue"
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="relative -top-px ml-4 pt-[7px] text-13 text-muted">
                    Fermé
                  </p>
                )}
              </div>
            ))}
          </div>
          <div className="mt-[44px] h-px bg-separator" />
          <div className="mt-[19px] flex items-start justify-between">
            <div>
              <p className="relative -top-px text-13 font-semibold">
                Supprimer le département
              </p>
              <p className="mt-1 text-12 text-muted">
                Ses colis et ses comptes doivent d’abord passer à un autre
                département.
              </p>
            </div>
            <Button
              variant="outline"
              size="desk"
              className="w-[120px] text-red"
            >
              Supprimer…
            </Button>
          </div>
        </div>
        <DeskPanel overlayStroke
          title="QR du département"
          subtitle="La navette le scanne au dépôt"
          className="h-[420px] w-[336px]"
        >
          <DepartmentQr size={200} className="mx-auto mt-[21px] flex w-fit" />
          <p className="mt-3 text-center text-13 font-semibold">
            Studio · Atelier Lumen
          </p>
          <div className="mt-4 flex flex-col gap-2 px-4">
            <Button
              size="desk"
              icon="printer"
              block
              className="justify-start"
            >
              Imprimer l’affiche
            </Button>
            <Button
              variant="outline"
              size="desk"
              icon="refresh"
              block
              className="justify-start"
            >
              Régénérer
            </Button>
          </div>
        </DeskPanel>
      </div>
    </CompanyShell>
  );
}

const PHONE_LINES: Record<string, string> = {
  'service-courrier': '3 comptes',
  studio: '12 présents · 6 à venir',
  finance: '8 présents · 5 à venir',
  juridique: '17 présents · 3 à venir',
};

/** The departments on the phone. */
export function DepartementsMobile() {
  return (
    <PhoneSettings
      title="Départements"
      tone="white"
      trailing={<PhoneBarButton icon="plus" label="Nouveau département" />}
    >
      <div className="mt-4">
        {DEPARTMENTS.map((d) => (
          <div key={d.id} className="relative h-[76px] pt-3">
            <ListRow
              leading={
                <IconTile
                  icon={d.id === 'service-courrier' ? 'truck' : 'building'}
                  tone="fill"
                  className="mt-[1px] rounded-full"
                />
              }
              title={d.name}
              lines={[d.place, PHONE_LINES[d.id]].map((line) => ({
                text: <span className="relative -top-px">{line}</span>,
              }))}
              trailing={
                <Icon
                  name="chevron"
                  size={16}
                  strokeWidth={2.2}
                  className="mt-[9px] text-faint"
                />
              }
            />
            <span className="absolute top-[79px] right-0 left-[52px] h-px bg-separator" />
          </div>
        ))}
      </div>
    </PhoneSettings>
  );
}

/** One department on the phone, with its QR to print or share. */
export function FicheDepartementMobile() {
  return (
    <PhoneSettings title="Studio" trailing={<NavBarAction>OK</NavBarAction>}>
      <PhoneGroup className="mt-4">
        <PhoneSettingRow
          icon={{ name: 'pin', tone: 'red' }}
          title="Lieu"
          value="Bât. A, 2e ét."
          separator
        />
        <PhoneSettingRow
          icon={{ name: 'clock', tone: 'orange' }}
          title="Horaires"
          value="Lun.–ven."
          separator
        />
        <PhoneSettingRow
          icon={{ name: 'info', tone: 'grey' }}
          title="Consignes"
          value="1 ligne"
        />
      </PhoneGroup>
      <PhoneGroup className="mt-6">
        <PhoneSettingRow
          icon={{ name: 'users', tone: 'ink' }}
          title="Comptes"
          value="12"
          separator
        />
        <PhoneSettingRow
          icon={{ name: 'users', tone: 'ink' }}
          title="Annuaire"
          value="84"
        />
      </PhoneGroup>
      <PhoneGroup className="mt-8 h-[300px] pt-5">
        <DepartmentQr size={160} className="mx-auto flex w-fit" />
        <div className="mt-5 px-5">
          <Button block variant="secondary" icon="share" iconSize={20} className="gap-2">
            Imprimer ou partager
          </Button>
        </div>
        <p className="relative -top-px mt-3.5 text-center text-13 text-muted">
          La navette le scanne au dépôt.
        </p>
      </PhoneGroup>
    </PhoneSettings>
  );
}

/** The opening hours of a department, on the phone. */
export function HorairesDepartementMobile() {
  return (
    <PhoneSettings title="Horaires" trailing={<NavBarAction>OK</NavBarAction>}>
      <PhoneGroup className="mt-4">
        {WEEK.map(({ day, slots }, i) => (
          <PhoneSettingRow
            key={day}
            title={day}
            chevron={false}
            value={<span className="shrink-0 text-16 text-muted">{slots.join(', ') || 'Fermé'}</span>}
            separator={i < WEEK.length - 1}
            raised={day === 'Vendredi'}
          />
        ))}
      </PhoneGroup>
      <p className="relative -top-px mt-3 px-4 text-13 text-muted">
        Repris dans chaque avis de retrait du Studio.
      </p>
    </PhoneSettings>
  );
}

/** The A4 poster that the shuttle scans at the department's door. */
export type DepartmentPosterProps = {
  initials: string;
  company: string;
  name: string;
  place?: string | null;
  matrix: string[];
  instruction: string;
  hours?: string;
  code: string;
};

/** The poster at the reception point: `print:` strips the app around it. */
export function DepartmentPoster({
  initials,
  company,
  name,
  place,
  matrix,
  instruction,
  hours,
  code,
}: DepartmentPosterProps) {
  return (
    <div className="relative h-[842px] w-[595px] bg-white text-black">
      <span className="absolute top-12 left-12 flex size-12 items-center justify-center rounded-[10px] bg-black text-[19px] font-bold text-white">
        {initials}
      </span>
      <p className="absolute top-[62px] left-[108px] text-18 font-semibold">
        {company}
      </p>
      <h1 className="absolute top-[150px] left-12 text-[56px] leading-[1.2] font-bold tracking-[-1px]">
        {name}
      </h1>
      {place && (
        <p className="absolute top-[222px] left-12 text-20">{place}</p>
      )}
      <QrCode
        matrix={matrix}
        module={300 / matrix.length}
        label={code}
        className="absolute top-[290px] left-[147px] rounded-none p-0"
      />
      <p className="absolute top-[631px] left-12 w-[499px] text-center text-18">
        {instruction}
      </p>
      <span className="absolute top-[720px] left-12 h-px w-[499px] bg-separator" />
      {hours && (
        <p className="absolute top-[739px] left-12 w-[499px] text-center text-14">
          {hours}
        </p>
      )}
      <p className="absolute top-[790px] left-12 w-[499px] text-center font-mono text-11">
        {code}
      </p>
    </div>
  );
}

export function AfficheQrA4() {
  return (
    <div className="relative h-[842px] w-[595px] bg-white text-black after:pointer-events-none after:absolute after:inset-0 after:border after:border-separator">
      <span className="absolute top-12 left-12 flex size-12 items-center justify-center rounded-[10px] bg-black text-[19px] font-bold text-white">
        AL
      </span>
      <p className="absolute top-[62px] left-[108px] text-18 font-semibold">
        Atelier Lumen
      </p>
      <h1 className="absolute top-[150px] left-12 text-[56px] leading-[1.2] font-bold tracking-[-1px]">
        Studio
      </h1>
      <p className="absolute top-[222px] left-12 text-20 text-ink-2">
        Bât. A, 2e étage, accueil
      </p>
      <DepartmentQr size={300} className="absolute top-[290px] left-[147px]" />
      <p className="absolute top-[631px] left-12 w-[499px] text-center text-18 whitespace-nowrap">
        Navette : scannez ce code pour déposer les colis du Studio.
      </p>
      <span className="absolute top-[720px] left-12 h-px w-[499px] bg-separator" />
      <p className="absolute top-[739px] left-12 w-[499px] text-center text-14 text-muted">
        Retrait des colis : lun.–ven. 9:00–12:30, 14:00–18:00
      </p>
      <p className="absolute top-[790px] left-12 w-[499px] text-center font-mono text-11 text-muted">
        Code DEP-STU-7Q4 · généré le 29 octobre 2026
      </p>
    </div>
  );
}
