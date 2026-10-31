import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  ACCOUNT,
  COMPANY,
  COMPANY_ADMIN_NAV,
  crumbs,
  DEPARTMENT_NAV,
} from '#fixtures/multi-entreprises';
import type { IconName } from '#icons';
import {
  AnnuaireDesktop,
  type AnnuairePerson,
  ImportCsvDesktop,
  PersonFormPanel,
  PersonRecordPanel,
} from '#screens/multi-entreprises/14-annuaire/annuaire-desktop-screen';
import {
  AnnuaireMobile,
  MoveSheetMobile,
  PersonFormMobile,
} from '#screens/multi-entreprises/14-annuaire/annuaire-mobile-screen';

const meta = {
  title: 'Écrans/Multi-entreprises/14 Annuaire/Annuaire',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const DESKTOP = { viewport: { value: 'landingDesktop', isRotated: false } };
const MOBILE = { viewport: { value: 'iphone15', isRotated: false } };
const PAGE = 'multi-entreprises/14-annuaire/annuaire--';

function entry(
  name: string,
  department: string | undefined,
  place: string,
  open: number,
): AnnuairePerson {
  const email = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(' ', '.');
  const address = `${email}@atelier-lumen.fr`;
  return { id: address, name, email: address, department, place, open };
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

const MOVE_EFFECTS: readonly { icon: IconName; text: string }[] = [
  { icon: 'truck', text: '1 colis en route ira à Finance' },
  { icon: 'alert', text: '1 colis déposé au Studio passera « À régulariser »' },
  { icon: 'mail', text: 'Ses prochains e-mails citeront le lieu de Finance' },
];

const DEPARTMENTS = [
  { id: 'studio', label: 'Studio' },
  { id: 'finance', label: 'Finance' },
  { id: 'juridique', label: 'Juridique' },
];

const ADMIN_SHELL = {
  company: COMPANY.admin,
  nav: COMPANY_ADMIN_NAV,
  account: ACCOUNT.companyAdmin,
  companyCrumb: crumbs('Atelier Lumen')[0]!,
};

export const DepartementOrdinateur: Story = {
  name: 'Département · ordinateur',
  parameters: {
    reference: `${PAGE}departement-annuaire-du-departement-ordinateur`,
  },
  globals: DESKTOP,
  render: () => (
    <AnnuaireDesktop
      company={COMPANY.studio}
      nav={DEPARTMENT_NAV}
      account={ACCOUNT.department}
      companyCrumb={crumbs('Studio')[0]!}
      variant="department"
      title="Annuaire du Studio"
      subtitle="84 salariés · visibles aussi par l’administrateur"
      people={STUDIO_ENTRIES}
      range="1–8 sur 84"
      panel={
        <PersonFormPanel
          title="Ajouter un salarié"
          value={{
            name: 'Hugo Lefèvre',
            email: 'hugo.lefevre@atelier-lumen.fr',
            site: '2e étage',
            departmentId: '',
          }}
          conflict={{
            title: 'Cette adresse est déjà à Finance',
            description:
              'Vous ne pouvez pas modifier un salarié d’un autre département. Demandez le déplacement à l’administrateur.',
            action: { label: 'Demander le déplacement', icon: 'move' },
          }}
          submitLabel="Ajouter"
        />
      }
    />
  ),
};

const letters = (...groups: [string, [string, string, string][]][]) =>
  groups.map(([letter, people]) => ({
    letter,
    people: people.map(([id, name, detail]) => ({
      id,
      name,
      initials: id,
      detail,
    })),
  }));

export const DepartementMobile: Story = {
  name: 'Département · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: `${PAGE}departement-annuaire-du-departement-mobile`,
  },
  globals: MOBILE,
  render: () => (
    <AnnuaireMobile
      title="Annuaire du Studio"
      searchPlaceholder="Nom ou e-mail"
      groups={letters(
        [
          'A',
          [
            ['AM', 'Antoine Martin', '2e étage'],
            ['AB', 'Axelle Bernard', '2e étage'],
          ],
        ],
        ['C', [['CM', 'Camille Morel', 'poste 214']]],
      )}
    />
  ),
};

export const AjouterMobile: Story = {
  name: 'Ajouter un salarié · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: `${PAGE}departement-ajouter-un-salarie-mobile`,
  },
  globals: MOBILE,
  render: () => (
    <PersonFormMobile
      title="Nouveau salarié"
      submitLabel="Ajouter"
      value={{
        name: 'Jules Perret',
        email: 'jules.perret@atelier-lumen.fr',
        site: '2e étage',
        departmentId: '',
      }}
      note="Ajouté au Studio. Ses colis y seront déposés."
    />
  ),
};

export const AjouterDejaAilleursMobile: Story = {
  name: 'Ajouter, déjà ailleurs · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: `${PAGE}departement-ajouter-deja-ailleurs-mobile`,
  },
  globals: MOBILE,
  render: () => (
    <PersonFormMobile
      title="Nouveau salarié"
      submitLabel="Ajouter"
      value={{
        name: 'Hugo Lefèvre',
        email: 'hugo.lefevre@atelier-lumen.fr',
        site: '',
        departmentId: '',
      }}
      conflict={{
        title: 'Déjà dans l’annuaire de Finance',
        description: 'Demandez à l’administrateur de le déplacer au Studio.',
        action: 'Demander le déplacement',
      }}
    />
  ),
};

export const AdminDeplacerOrdinateur: Story = {
  name: 'Admin, déplacer un salarié · ordinateur',
  parameters: {
    reference: `${PAGE}admin-entreprise-annuaire-deplacer-un-salarie-ordinateur`,
  },
  globals: DESKTOP,
  render: () => (
    <AnnuaireDesktop
      {...ADMIN_SHELL}
      variant="company"
      title="Annuaire"
      subtitle="312 salariés dans 4 départements"
      tabs={[
        { id: 'tous', label: 'Tous 312', width: 56 },
        { id: 'studio', label: 'Studio 84', width: 58 },
        { id: 'finance', label: 'Finance 61', width: 64 },
        { id: 'juridique', label: 'Juridique 47', width: 74 },
        { id: 'courrier', label: 'Service courrier 117', width: 115 },
        { id: 'sans', label: 'Sans département 3' },
      ]}
      activeTab="tous"
      people={COMPANY_ENTRIES}
      activePerson="camille.morel@atelier-lumen.fr"
      range="1–10 sur 312"
      panel={
        <PersonRecordPanel
          name="Camille Morel"
          email="camille.morel@atelier-lumen.fr"
          initials="CM"
          departments={DEPARTMENTS}
          target="finance"
          effects={MOVE_EFFECTS}
          details={[
            { label: 'Lieu', value: 'poste 214' },
            { label: 'Colis en cours', value: '1' },
            { label: 'Ajouté', value: 'Import du 18 oct.' },
            { label: 'Dernier retrait', value: 'Lun., 12:40' },
          ]}
        />
      }
    />
  ),
};

export const AdminImportOrdinateur: Story = {
  name: 'Admin, import CSV · ordinateur',
  parameters: {
    reference: `${PAGE}admin-entreprise-import-csv-verification-ordinateur`,
  },
  globals: DESKTOP,
  render: () => (
    <ImportCsvDesktop
      {...ADMIN_SHELL}
      subtitle="annuaire-dsi-octobre.csv · 315 lignes · séparateur « ; » reconnu"
      columns={[
        { source: 'nom', target: 'Nom' },
        { source: 'prenom', target: 'Prénom' },
        { source: 'mail', target: 'E-mail' },
        { source: 'service', target: 'Département' },
        { source: 'bureau', target: 'Lieu' },
      ]}
      figures={[
        { label: 'À ajouter', value: '298' },
        { label: 'À mettre à jour', value: '12' },
        { label: 'Déjà à jour', value: '3' },
        { label: 'Lignes en erreur', value: '2', red: true },
      ]}
      errors={[
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
      ]}
      unknown={{ name: 'Marketing', lines: 41, departments: DEPARTMENTS }}
      summary="310 salariés seront importés · 2 lignes ignorées"
      submitLabel="Importer 310 salariés"
    />
  ),
};

export const AdminMobile: Story = {
  name: 'Admin, annuaire · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: `${PAGE}admin-entreprise-annuaire-mobile`,
  },
  globals: MOBILE,
  render: () => (
    <AnnuaireMobile
      title="Annuaire"
      searchPlaceholder="Nom, département, e-mail"
      filter={{
        options: ['Tous', 'Studio', 'Finance', 'Juridique'],
        value: 'Tous',
      }}
      groups={letters(
        [
          'C',
          [
            ['CM', 'Camille Morel', 'Studio'],
            ['CR', 'Claire Robin', 'Finance'],
          ],
        ],
        [
          'H',
          [
            ['HD', 'Hélène Dubois', 'Finance'],
            ['HL', 'Hugo Lefèvre', 'Studio'],
          ],
        ],
      )}
    />
  ),
};

export const AdminDeplacerSheetMobile: Story = {
  name: 'Admin, déplacer un salarié · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: `${PAGE}admin-entreprise-deplacer-un-salarie-mobile`,
  },
  globals: MOBILE,
  render: () => (
    <MoveSheetMobile
      name="Camille Morel"
      departments={DEPARTMENTS}
      currentId="studio"
      targetId="finance"
      effect={{
        title: '1 colis passera « À régulariser »',
        description:
          'Il est déjà déposé au Studio. Le colis en route ira à Finance.',
      }}
      submitLabel="Déplacer vers Finance"
    />
  ),
};
