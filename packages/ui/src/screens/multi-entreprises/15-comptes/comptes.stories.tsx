import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  ACCOUNT,
  COMPANY,
  COMPANY_ADMIN_NAV,
} from '#fixtures/multi-entreprises';
import {
  COMPTE_ROLE_OPTIONS,
  CompteFormPanel,
  CompteRecordPanel,
  type CompteRow,
  ComptesDesktop,
  ComptesErreurDesktop,
  type ComptesSelect,
  type ComptesShell,
} from '#screens/multi-entreprises/15-comptes/comptes-desktop-screen';
import {
  CompteFormMobile,
  CompteRecordMobile,
  ComptesMobile,
  CompteSuspenduScreen,
} from '#screens/multi-entreprises/15-comptes/comptes-mobile-screen';

const meta = {
  title: 'Écrans/Multi-entreprises/15 Comptes/Admin entreprise',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const DESKTOP = { viewport: { value: 'landingDesktop', isRotated: false } };
const MOBILE = { viewport: { value: 'iphone15', isRotated: false } };
const PAGE = 'multi-entreprises/15-comptes/comptes--admin-entreprise-';

const KIND: Record<string, CompteRow['stateKind']> = {
  'Invitation envoyée': 'invited',
  Suspendu: 'suspended',
};

const row = (
  name: string,
  email: string,
  role: CompteRow['role'],
  department: string,
  state: string,
  lastLogin: string,
): CompteRow => ({
  id: `${email}@atelier-lumen.fr`,
  name,
  email: `${email}@atelier-lumen.fr`,
  role,
  department,
  state,
  stateKind: KIND[state] ?? 'active',
  lastLogin,
});

const ROWS: CompteRow[] = [
  row('Karim Daoud', 'karim.daoud', 'navette', 'Service courrier', 'Actif', 'Aujourd’hui, 8:02'),
  row('Sophie Lambert', 'sophie.lambert', 'navette', 'Service courrier', 'Actif', 'Hier, 17:40'),
  row('Julie Perrin', 'julie.perrin', 'departement', 'Studio', 'Actif', 'Aujourd’hui, 10:51'),
  row('Thomas Moreau', 'thomas.moreau', 'departement', 'Studio', 'Actif', 'Lun., 9:15'),
  row('Nadia Kessler', 'nadia.kessler', 'departement', 'Finance', 'Invitation envoyée', '—'),
  row('Bruno Vidal', 'bruno.vidal', 'departement', 'Juridique', 'Actif', 'Aujourd’hui, 9:30'),
  row('Élise Garnier', 'elise.garnier', 'departement', 'Finance', 'Suspendu', 'Il y a 3 semaines'),
  row('Claire Bonnet', 'claire.bonnet', 'admin', '—', 'Actif', 'Maintenant'),
];

const select = (label: string): ComptesSelect => ({
  value: label,
  label,
  options: [{ id: label, label }],
});

const SHELL: ComptesShell = {
  company: COMPANY.admin,
  nav: COMPANY_ADMIN_NAV,
  account: ACCOUNT.companyAdmin,
  companyCrumb: 'Atelier Lumen',
};

const LIST = {
  ...SHELL,
  title: 'Comptes',
  subtitle: '48 comptes · 2 invitations en attente',
  tabs: [
    { id: 'all', label: 'Tous', count: 48 },
    { id: 'shuttle', label: 'Navettes', count: 3 },
    { id: 'department', label: 'Départements', count: 43 },
    { id: 'company_admin', label: 'Administrateurs', count: 2 },
  ],
  activeTab: 'all',
  departmentFilter: select('Tous'),
  stateFilter: select('Tous'),
  rows: ROWS,
  range: '1–8 sur 48',
  onExport: () => {},
  addLabel: 'Inviter un compte',
};

const RECORD = (
  <CompteRecordPanel
    initials="JP"
    name="Julie Perrin"
    email="julie.perrin@atelier-lumen.fr"
    details={[
      { label: 'Rôle', value: 'Département' },
      { label: 'État', value: 'Actif' },
      { label: 'Invité par', value: 'Claire Bonnet' },
      { label: 'Dernière connexion', value: 'Aujourd’hui, 10:51' },
      { label: 'Appareils', value: 'iPhone, ordinateur' },
    ]}
    department={select('Studio')}
    departmentHint="Ses colis et son annuaire suivent ce département."
    passwordLabel="Renvoyer un lien de mot de passe"
    stateAction={{ label: 'Suspendre le compte', danger: true, icon: 'pause' }}
  />
);

const invitePanel = (taken: boolean) => (
  <CompteFormPanel
    title="Inviter un compte"
    value={{
      role: 'department',
      departmentId: 'Finance',
      name: 'Nadia Kessler',
      email: 'nadia.kessler@atelier-lumen.fr',
      password: '',
    }}
    department={select('Finance')}
    hint={
      taken
        ? 'Cette adresse a déjà un compte ou une invitation en attente.'
        : 'Elle recevra un lien valable 7 jours.'
    }
    taken={taken}
    submitLabel="Envoyer l’invitation"
    submitIcon="send"
  />
);

const MOBILE_SECTIONS = [
  {
    title: 'Navettes',
    count: 2,
    rows: [
      { id: 'kd', initials: 'KD', name: 'Karim Daoud', line: 'Service courrier' },
      { id: 'sl', initials: 'SL', name: 'Sophie Lambert', line: 'Service courrier' },
    ],
  },
  {
    title: 'Départements',
    count: 5,
    rows: [
      { id: 'jp', initials: 'JP', name: 'Julie Perrin', line: 'Studio' },
      { id: 'tm', initials: 'TM', name: 'Thomas Moreau', line: 'Studio' },
      { id: 'nk', initials: 'NK', name: 'Nadia Kessler', line: 'Finance', state: { label: 'Invitation envoyée', kind: 'invited' as const } },
      { id: 'bv', initials: 'BV', name: 'Bruno Vidal', line: 'Juridique' },
      { id: 'eg', initials: 'ÉG', name: 'Élise Garnier', line: 'Finance', state: { label: 'Suspendu', kind: 'suspended' as const } },
    ],
  },
];

const inviteMobile = (taken: boolean) => (
  <CompteFormMobile
    title="Inviter"
    roles={['Navette', 'Département', 'Admin']}
    role="Département"
    department={{ value: 'Finance', label: 'Finance', options: [{ id: 'Finance', label: 'Finance' }] }}
    name="Nadia Kessler"
    email="nadia.kessler@atelier-lumen.fr"
    hint={
      taken
        ? 'Cette adresse a déjà un compte ou une invitation en attente.'
        : 'Un lien valable 7 jours lui sera envoyé.'
    }
    taken={taken}
    submitLabel="Envoyer l’invitation"
    submitIcon="send"
  />
);

export const ListeOrdinateur: Story = {
  name: 'Liste · ordinateur',
  parameters: { reference: `${PAGE}comptes-ordinateur` },
  globals: DESKTOP,
  render: () => <ComptesDesktop {...LIST} />,
};

export const ListeMobile: Story = {
  name: 'Liste · mobile',
  parameters: { device: { tone: 'light' }, reference: `${PAGE}comptes-mobile` },
  globals: MOBILE,
  render: () => <ComptesMobile title="Comptes" sections={MOBILE_SECTIONS} />,
};

export const DetailOrdinateur: Story = {
  name: 'Détail · ordinateur',
  parameters: { reference: `${PAGE}compte-detail-ordinateur` },
  globals: DESKTOP,
  render: () => (
    <ComptesDesktop
      {...LIST}
      activeRow="julie.perrin@atelier-lumen.fr"
      panel={RECORD}
    />
  ),
};

export const DetailMobile: Story = {
  name: 'Détail · mobile',
  parameters: { device: { tone: 'light' }, reference: `${PAGE}compte-mobile` },
  globals: MOBILE,
  render: () => (
    <CompteRecordMobile
      initials="JP"
      name="Julie Perrin"
      email="julie.perrin@atelier-lumen.fr"
      role={{ value: 'Département' }}
      department={{ value: 'Studio', select: select('Studio') }}
      lastLogin="10:51"
      actions={[
        { label: 'Renvoyer un lien de mot de passe' },
        { label: 'Suspendre le compte', danger: true },
      ]}
    />
  ),
};

export const ErreurOrdinateur: Story = {
  name: 'Erreur · ordinateur',
  parameters: { reference: `${PAGE}comptes-erreur-ordinateur` },
  globals: DESKTOP,
  render: () => <ComptesErreurDesktop {...SHELL} />,
};

export const InviterOrdinateur: Story = {
  name: 'Inviter · ordinateur',
  parameters: { reference: `${PAGE}inviter-un-compte-ordinateur` },
  globals: DESKTOP,
  render: () => <ComptesDesktop {...LIST} panel={invitePanel(false)} />,
};

export const InviterMobile: Story = {
  name: 'Inviter · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: `${PAGE}inviter-un-compte-mobile`,
  },
  globals: MOBILE,
  render: () => inviteMobile(false),
};

export const AdresseUtiliseeOrdinateur: Story = {
  name: 'Adresse déjà utilisée · ordinateur',
  parameters: { reference: `${PAGE}inviter-adresse-deja-utilisee-ordinateur` },
  globals: DESKTOP,
  render: () => <ComptesDesktop {...LIST} panel={invitePanel(true)} />,
};

export const AdresseUtiliseeMobile: Story = {
  name: 'Adresse déjà utilisée · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: `${PAGE}inviter-adresse-deja-utilisee-mobile`,
  },
  globals: MOBILE,
  render: () => inviteMobile(true),
};

export const CreerOrdinateur: Story = {
  name: 'Créer avec un mot de passe · ordinateur (sans maquette)',
  globals: DESKTOP,
  render: () => (
    <ComptesDesktop
      {...LIST}
      panel={
        <CompteFormPanel
          title="Créer un compte"
          value={{
            role: COMPTE_ROLE_OPTIONS[1]?.id ?? '',
            departmentId: 'Finance',
            name: 'Nadia Kessler',
            email: 'nadia.kessler@atelier-lumen.fr',
            password: 'motdepasse',
          }}
          department={select('Finance')}
          passwordLabel="Mot de passe provisoire"
          hint="À lui transmettre : il pourra le changer depuis son compte."
          submitLabel="Créer le compte"
          submitIcon="userPlus"
        />
      }
    />
  ),
};

export const CompteSuspendu: Story = {
  name: 'Compte suspendu, sur le téléphone (sans maquette)',
  parameters: { device: { tone: 'light' } },
  globals: MOBILE,
  render: () => (
    <CompteSuspenduScreen
      title="Compte suspendu"
      lines={[
        'Vos photos et preuves restent sur ce téléphone.',
        'Demandez à votre administrateur de réactiver le compte.',
      ]}
      retryLabel="Vérifier à nouveau"
    />
  ),
};
