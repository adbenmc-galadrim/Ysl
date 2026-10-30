import { Banner } from '#components/banner';
import { Button } from '#components/button';
import { CompanyShell, DeskPageHeader } from '#components/company-shell';
import {
  DeskTable,
  DeskTablePagination,
  type DeskTableColumn,
} from '#components/desk-table';
import { DeskTabs } from '#components/desk-tabs';
import { Avatar } from '#components/avatar';
import {
  ACCOUNT,
  COMPANY,
  COMPANY_ADMIN_NAV,
  crumbs,
  DEPARTMENT_NAV,
} from '#fixtures/multi-entreprises';
import { Icon, type IconName } from '#icons';
import {
  DeskPanel,
  DeskPanelFacts,
  DeskPanelField,
} from '#screens/multi-entreprises/14-annuaire/directory-parts';

type DirectoryEntry = {
  name: string;
  email: string;
  department?: string;
  place: string;
  open: number;
};

function entry(
  name: string,
  department: string | undefined,
  place: string,
  open: number,
): DirectoryEntry {
  const email = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(' ', '.');
  return { name, email: `${email}@atelier-lumen.fr`, department, place, open };
}

const STUDIO_ENTRIES = [
  entry('Axelle Bernard', undefined, '2e étage', 1),
  entry('Antoine Martin', undefined, '2e étage', 0),
  entry('Camille Morel', undefined, 'poste 214', 1),
  entry('Hugo Lefèvre', undefined, '2e étage', 1),
  entry('Inès Garnier', undefined, '2e étage', 1),
  entry('Jules Perret', undefined, '2e étage', 0),
  entry('Mona Aubry', undefined, 'poste 220', 0),
  entry('Samuel Petit', undefined, '2e étage', 2),
];

const COMPANY_ENTRIES = [
  entry('Axelle Bernard', 'Studio', '2e étage', 1),
  entry('Antoine Martin', 'Studio', '2e étage', 0),
  entry('Camille Morel', 'Studio', 'poste 214', 1),
  entry('Claire Robin', 'Finance', '4e étage', 0),
  entry('Hugo Lefèvre', 'Studio', '2e étage', 1),
  entry('Hélène Dubois', 'Finance', 'bureau 410', 2),
  entry('Inès Garnier', 'Studio', '2e étage', 1),
  entry('Léa Fontaine', 'Finance', '4e étage', 1),
  entry('Malik Benali', 'Juridique', '5e étage', 0),
  entry('Nora Haddad', 'Finance', '4e étage', 1),
];

const NAME_COLUMN: Pick<DeskTableColumn<DirectoryEntry>, 'key' | 'header' | 'cell'> = {
  key: 'name',
  header: 'Nom',
  cell: (e) => <span className="font-semibold">{e.name}</span>,
};

const EMAIL_COLUMN: Pick<DeskTableColumn<DirectoryEntry>, 'key' | 'header' | 'cell'> = {
  key: 'email',
  header: 'E-mail',
  cell: (e) => <span className="text-ink-2">{e.email}</span>,
};

const PLACE_COLUMN: Pick<DeskTableColumn<DirectoryEntry>, 'key' | 'header' | 'cell'> = {
  key: 'place',
  header: 'Lieu',
  cell: (e) => <span className="text-ink-2">{e.place}</span>,
};

const STUDIO_COLUMNS: DeskTableColumn<DirectoryEntry>[] = [
  { ...NAME_COLUMN, width: 190 },
  { ...EMAIL_COLUMN, width: 250 },
  { ...PLACE_COLUMN, width: 140 },
  {
    key: 'open',
    header: 'Colis en cours',
    cell: (e) => <span className="w-24 text-right">{e.open}</span>,
  },
];

const COMPANY_COLUMNS: DeskTableColumn<DirectoryEntry>[] = [
  { ...NAME_COLUMN, width: 170 },
  { ...EMAIL_COLUMN, width: 230 },
  {
    key: 'department',
    header: 'Département',
    width: 130,
    cell: (e) => e.department,
  },
  { ...PLACE_COLUMN, width: 110 },
  {
    key: 'open',
    header: 'En cours',
    cell: (e) => <span className="w-14 text-right">{e.open}</span>,
  },
];

/** The Studio's directory, with an add refused because the address is taken. */
export function DepartementAnnuaireDesktop() {
  return (
    <CompanyShell
      company={COMPANY.studio}
      nav={DEPARTMENT_NAV}
      active="annuaire"
      account={ACCOUNT.department}
      breadcrumb={crumbs('Studio', 'Annuaire')}
      searchPlaceholder="Nom ou e-mail"
    >
      <DeskPageHeader
        title="Annuaire du Studio"
        subtitle="84 salariés · visibles aussi par l’administrateur"
        actions={
          <Button icon="userPlus" size="desk" className="w-[158px] justify-start">
            Ajouter un salarié
          </Button>
        }
      />
      <div className="mt-2 flex items-start gap-4">
        <DeskTable
          label="Salariés du Studio"
          className="w-[776px] shrink-0"
          columns={STUDIO_COLUMNS}
          rows={STUDIO_ENTRIES}
          rowKey={(e) => e.email}
          footer={<DeskTablePagination range="1–8 sur 84" />}
        />
        <DeskPanel className="h-[520px] w-[360px]">
          <h2 className="mt-3 ml-[15px] text-14 font-semibold">
            Ajouter un salarié
          </h2>
          <div className="mt-3.5 h-px bg-separator" />
          <div className="mt-[15px] flex flex-col gap-3 px-[15px]">
            <DeskPanelField label="Prénom et nom" value="Hugo Lefèvre" />
            <DeskPanelField
              label="E-mail"
              value="hugo.lefevre@atelier-lumen.fr"
              invalid
            />
            <DeskPanelField label="Lieu" value="2e étage" />
          </div>
          <div className="px-[15px]">
            <Banner
              tone="orange"
              icon="alert"
              iconSize={16}
              title="Cette adresse est déjà à Finance"
              description="Vous ne pouvez pas modifier un salarié d’un autre département. Demandez le déplacement à l’administrateur."
              className="mt-6 h-[108px] items-start gap-2 rounded-[6px] py-0 pr-3 pl-3"
              classNames={{
                icon: 'mt-3',
                title: 'mt-[10px] text-13',
                description: 'mt-[5px] text-12 leading-[14px]',
              }}
            />
            <Button
              variant="outline"
              size="desk"
              icon="move"
              className="mt-4 w-full justify-start"
            >
              Demander le déplacement
            </Button>
            <div className="mt-12 flex gap-2">
              <Button variant="outline" size="desk" className="w-[100px]">
                Annuler
              </Button>
              <Button size="desk" className="w-[220px]">
                Ajouter
              </Button>
            </div>
          </div>
        </DeskPanel>
      </div>
    </CompanyShell>
  );
}

const MOVE_EFFECTS: readonly (readonly [IconName, string])[] = [
  ['truck', '1 colis en route ira à Finance'],
  ['alert', '1 colis déposé au Studio passera « À régulariser »'],
  ['mail', 'Ses prochains e-mails citeront le lieu de Finance'],
];

/** The company's directory, one record open on the move to another department. */
export function AdminAnnuaireDeplacerDesktop() {
  return (
    <CompanyShell
      company={COMPANY.admin}
      nav={COMPANY_ADMIN_NAV}
      active="annuaire"
      account={ACCOUNT.companyAdmin}
      breadcrumb={crumbs('Atelier Lumen', 'Annuaire')}
      searchPlaceholder="Nom ou e-mail"
    >
      <DeskPageHeader
        title="Annuaire"
        subtitle="312 salariés dans 4 départements"
        actions={
          <>
            <Button
              variant="outline"
              size="desk"
              icon="upload"
              className="w-[146px] justify-start"
            >
              Importer un CSV
            </Button>
            <Button icon="plus" size="desk" className="w-24 justify-start">
              Ajouter
            </Button>
          </>
        }
      />
      <DeskTabs
        label="Départements"
        active="tous"
        className="mt-3"
        tabs={[
          { id: 'tous', label: 'Tous 312', width: 56 },
          { id: 'studio', label: 'Studio 84', width: 58 },
          { id: 'finance', label: 'Finance 61', width: 64 },
          { id: 'juridique', label: 'Juridique 47', width: 74 },
          { id: 'courrier', label: 'Service courrier 117', width: 115 },
          { id: 'sans', label: 'Sans département 3' },
        ]}
      />
      <div className="mt-[19px] flex items-start gap-4">
        <DeskTable
          label="Salariés"
          className="w-[776px] shrink-0"
          columns={COMPANY_COLUMNS}
          rows={COMPANY_ENTRIES}
          rowKey={(e) => e.email}
          selectable
          activeRow="camille.morel@atelier-lumen.fr"
          footer={<DeskTablePagination range="1–10 sur 312" />}
        />
        <DeskPanel className="h-[640px] w-[360px]">
          <Avatar
            initials="CM"
            tone="fill"
            className="absolute top-[15px] left-[15px] rounded-full bg-fill-2 pb-px text-14"
          />
          <p className="absolute top-[15px] left-[67px] text-16 font-bold">
            Camille Morel
          </p>
          <p className="absolute top-[37px] left-[67px] text-12 text-muted">
            camille.morel@atelier-lumen.fr
          </p>
          <Icon
            name="x"
            size={16}
            className="absolute top-[15px] right-[15px] text-muted"
          />
          <div className="absolute inset-x-0 top-[71px] h-px bg-separator" />
          <div className="absolute inset-x-[15px] top-[87px]">
            <p className="relative -top-px h-4 text-13 font-semibold">
              Déplacer vers
            </p>
            <div className="mt-2 flex h-8 items-center justify-between rounded-[6px] pr-2.5 pb-[3px] pl-2.5 text-13 font-medium shadow-[0_0_0_0.5px_var(--color-ink-2),inset_0_0_0_0.5px_var(--color-ink-2)]">
              Finance
              <Icon name="chevron" size={12} className="mt-[3px] rotate-90 text-muted" />
            </div>
            <div className="mt-4 h-[132px] rounded-[6px] bg-orange-soft px-3 pt-2.5 text-13 text-orange-strong">
              <p className="relative -top-px h-4 font-semibold">
                Ce qui change pour ses colis
              </p>
              <ul className="mt-2 flex flex-col gap-3.5">
                {MOVE_EFFECTS.map(([icon, text]) => (
                  <li key={icon} className="flex h-4 gap-2">
                    <Icon name={icon} size={16} className="mt-px shrink-0" />
                    {text}
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" size="desk" className="w-[100px]">
                Annuler
              </Button>
              <Button size="desk" className="w-[220px]">
                Déplacer
              </Button>
            </div>
          </div>
          <div className="absolute inset-x-0 top-[355px] h-px bg-separator" />
          <div className="absolute inset-x-[15px] top-[370px]">
            <DeskPanelFacts
              valueLeft={130}
              facts={[
                ['Lieu', 'poste 214'],
                ['Colis en cours', '1'],
                ['Ajouté', 'Import du 18 oct.'],
                ['Dernier retrait', 'Lun., 12:40'],
              ]}
            />
          </div>
        </DeskPanel>
      </div>
    </CompanyShell>
  );
}

type ImportRow = {
  line: string;
  name: string;
  email: string;
  emailBad?: boolean;
  department: string;
  departmentBad?: boolean;
  problem: string;
  tone: 'red' | 'orange';
};

const IMPORT_ROWS: ImportRow[] = [
  {
    line: '14',
    name: 'Paul Mercier',
    email: 'paul.mercier@atelier-lumen',
    emailBad: true,
    department: 'Juridique',
    problem: 'E-mail incomplet : domaine manquant',
    tone: 'red',
  },
  {
    line: '201',
    name: 'Yanis Roche',
    email: 'yanis.roche@atelier-lumen.fr',
    department: 'Marketing',
    departmentBad: true,
    problem: 'Département inconnu',
    tone: 'orange',
  },
];

const IMPORT_COLUMNS: DeskTableColumn<ImportRow>[] = [
  {
    key: 'line',
    header: 'Ligne',
    width: 70,
    cell: (r) => <span className="mt-0.5 font-mono text-12">{r.line}</span>,
  },
  { key: 'name', header: 'Nom', width: 200, cell: (r) => r.name },
  {
    key: 'email',
    header: 'E-mail',
    width: 300,
    cell: (r) => (
      <span className={`mt-0.5 font-mono text-12 ${r.emailBad ? 'text-red' : ''}`}>
        {r.email}
      </span>
    ),
  },
  {
    key: 'department',
    header: 'Département',
    width: 180,
    cell: (r) => (
      <span className={r.departmentBad ? 'text-orange' : undefined}>
        {r.department}
      </span>
    ),
  },
  {
    key: 'problem',
    header: 'Problème',
    cell: (r) => (
      <span className="inline-flex items-center gap-1.5">
        <span
          className={`mt-[2.5px] size-2 rounded-full ${r.tone === 'red' ? 'bg-red' : 'bg-orange'}`}
        />
        {r.problem}
      </span>
    ),
  },
];

const CSV_COLUMNS = [
  ['nom', 'Nom'],
  ['prenom', 'Prénom'],
  ['mail', 'E-mail'],
  ['service', 'Département'],
  ['bureau', 'Lieu'],
] as const;

const IMPORT_FIGURES = [
  { label: 'À ajouter', value: '298' },
  { label: 'À mettre à jour', value: '12' },
  { label: 'Déjà à jour', value: '3' },
  { label: 'Lignes en erreur', value: '2', red: true },
];

/** The CSV has been read: what will be imported and what must be fixed first. */
export function AdminImportCsvDesktop() {
  return (
    <CompanyShell
      company={COMPANY.admin}
      nav={COMPANY_ADMIN_NAV}
      active="annuaire"
      account={ACCOUNT.companyAdmin}
      breadcrumb={crumbs('Atelier Lumen', 'Annuaire', 'Importer un CSV')}
    >
      <DeskPageHeader
        title="Importer un CSV"
        subtitle="annuaire-dsi-octobre.csv · 315 lignes · séparateur « ; » reconnu"
        actions={
          <Button variant="outline" size="desk" className="w-[140px]">
            Changer de fichier
          </Button>
        }
      />
      <h2 className="mt-4 h-[18px] text-15 font-semibold">Colonnes reconnues</h2>
      <div className="mt-2.5 flex gap-3">
        {CSV_COLUMNS.map(([source, target]) => (
          <div
            key={source}
            className="relative h-14 w-[220px] rounded-desk border border-separator"
          >
            <p className="absolute top-2 left-[11px] font-mono text-12 text-muted">
              Colonne « {source} »
            </p>
            <Icon
              name="arrowRight"
              size={14}
              className="absolute top-[30px] left-[11px] text-muted"
            />
            <p className="absolute top-[27px] left-[31px] text-13 font-semibold">
              {target}
            </p>
            <Icon
              name="check"
              size={16}
              className="absolute top-[29px] right-[9px] text-green"
            />
          </div>
        ))}
      </div>
      <div className="mt-5 flex h-[76px] rounded-desk border border-separator">
        {IMPORT_FIGURES.map((figure, i) => (
          <div key={figure.label} className="relative w-[288px] shrink-0">
            {i > 0 && (
              <div className="absolute top-[11px] -left-px h-[52px] w-px bg-separator" />
            )}
            <p className="absolute top-[11px] left-[15px] text-12 font-medium whitespace-nowrap text-muted">
              {figure.label}
            </p>
            <p
              className={`absolute top-[29px] left-[15px] text-22 font-bold ${figure.red ? 'text-red' : ''}`}
            >
              {figure.value}
            </p>
          </div>
        ))}
      </div>
      <h2 className="mt-6 h-[18px] text-15 font-semibold">
        À corriger avant d’importer
      </h2>
      <DeskTable
        label="Lignes en erreur"
        className="mt-2.5 shrink-0"
        columns={IMPORT_COLUMNS}
        rows={IMPORT_ROWS}
        rowKey={(r) => r.line}
        footer={<span />}
      />
      <div className="relative mt-[15px] h-24 shrink-0 rounded-desk border border-separator">
        <Icon
          name="info"
          size={18}
          className="absolute top-[17px] left-[15px]"
        />
        <p className="absolute top-[14px] left-[43px] text-14 font-semibold">
          « Marketing » n’existe pas encore (41 lignes)
        </p>
        <p className="absolute top-[36px] left-[43px] text-13 text-muted">
          Créez-le, ou rangez ces salariés dans un département existant.
        </p>
        <div className="absolute top-[29px] right-[15px] flex gap-2">
          <Button variant="outline" size="desk" className="relative w-[120px]">
            Ranger dans…
            <Icon
              name="chevron"
              size={12}
              className="absolute top-2.5 right-2.5"
            />
          </Button>
          <Button
            variant="outline"
            size="desk"
            icon="plus"
            className="w-[168px] justify-start"
          >
            Créer « Marketing »
          </Button>
        </div>
      </div>
      <p className="mt-5 text-12 text-muted">
        Les accents, majuscules et espaces sont corrigés à l’import. Les salariés
        absents du fichier ne sont pas supprimés.
      </p>
      <div className="absolute inset-x-0 bottom-0 flex h-16 items-start justify-between border-t border-separator bg-surface pt-[15px] pr-8 pl-8">
        <p className="mt-[6px] text-13 font-semibold">
          310 salariés seront importés · 2 lignes ignorées
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="desk" className="w-[84px]">
            Annuler
          </Button>
          <Button size="desk" className="w-[170px]">
            Importer 310 salariés
          </Button>
        </div>
      </div>
    </CompanyShell>
  );
}
