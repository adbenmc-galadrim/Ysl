import type {
  CompanyShellAccount,
  CompanyShellCompany,
  CompanyShellCrumb,
  CompanyShellNavItem,
  CompanyShellNavSection,
} from '#components/company-shell';

/** The sidebar header of each role, as the mockups name it. */
export const COMPANY = {
  /** The department's account. */
  studio: {
    name: 'Atelier Lumen',
    subtitle: 'Département Studio',
    initials: 'AL',
  },
  /** The company administrator's account. */
  admin: { name: 'Atelier Lumen', subtitle: 'Administrateur', initials: 'AL' },
  /** The same administrator, in the screen that has verified its domain. */
  ferrand: {
    name: 'Maison Ferrand',
    subtitle: 'Administrateur',
    initials: 'MF',
    logoTone: 'fill',
  },
  /** The application's own administrator. */
  platform: {
    name: 'Courrier',
    subtitle: 'Plateforme',
    initials: 'C',
    logoTone: 'fill',
  },
} as const satisfies Record<string, CompanyShellCompany>;

/** Who is signed in, at the bottom of the sidebar. */
export const ACCOUNT = {
  department: { initials: 'JP', name: 'Julie Perrin', role: 'Studio' },
  companyAdmin: {
    initials: 'CB',
    name: 'Claire Bonnet',
    role: 'Administratrice',
  },
  platform: {
    initials: 'SL',
    name: 'Sam Lefort',
    role: 'Administrateur de l’app',
  },
} as const satisfies Record<string, CompanyShellAccount>;

export const DEPARTMENT_NAV: CompanyShellNavSection[] = [
  {
    items: [
      { id: 'colis', label: 'Colis', icon: 'package', count: 12 },
      {
        id: 'depots',
        label: 'Dépôts à confirmer',
        icon: 'truck',
        count: 1,
        countTone: 'orange',
      },
      { id: 'annuaire', label: 'Annuaire', icon: 'users', count: 84 },
      { id: 'e-mails', label: 'E-mails', icon: 'send' },
    ],
  },
  {
    title: 'STUDIO',
    items: [
      { id: 'mon-departement', label: 'Mon département', icon: 'building' },
    ],
  },
];

export const COMPANY_ADMIN_NAV: CompanyShellNavSection[] = [
  {
    items: [
      { id: 'vue-d-ensemble', label: 'Vue d’ensemble', icon: 'dashboard' },
      {
        id: 'colis',
        label: 'Colis',
        icon: 'package',
        count: 3,
        countTone: 'red',
      },
      { id: 'departements', label: 'Départements', icon: 'building', count: 4 },
      { id: 'annuaire', label: 'Annuaire', icon: 'users', count: 312 },
      { id: 'comptes', label: 'Comptes', icon: 'key', count: 48 },
      { id: 'rapports', label: 'Rapports', icon: 'chart' },
    ],
  },
  {
    title: 'RÉGLAGES',
    items: [{ id: 'entreprise', label: 'Entreprise', icon: 'sliders' }],
  },
];

export const PLATFORM_NAV: CompanyShellNavSection[] = [
  {
    items: [
      { id: 'entreprises', label: 'Entreprises', icon: 'building', count: 5 },
      { id: 'journal', label: 'Journal', icon: 'file' },
    ],
  },
];

/** A nav with one entry changed, e.g. the red count of the e-mail tracking. */
export function withNavItem(
  nav: CompanyShellNavSection[],
  id: string,
  change: Partial<CompanyShellNavItem>,
): CompanyShellNavSection[] {
  return nav.map((section) => ({
    ...section,
    items: section.items.map((item) =>
      item.id === id ? { ...item, ...change } : item,
    ),
  }));
}

/**
 * Penpot estimated the width of each ancestor crumb, wider than its text, and
 * placed the separator after that estimate. Measured from the top bars.
 */
const CRUMB_WIDTH: Record<string, number> = {
  'Atelier Lumen': 81.8,
  Annuaire: 48.8,
  Colis: 29,
  Départements: 75,
  'E-mails': 42.2,
  Entreprise: 62,
  Entreprises: 68.6,
  Plateforme: 62,
  Studio: 35.6,
};

/** A breadcrumb whose separators fall where the mockups draw them. */
export function crumbs(...labels: string[]): CompanyShellCrumb[] {
  return labels.map((label) => ({ label, width: CRUMB_WIDTH[label] }));
}

export type CompanyStatus = 'active' | 'invited' | 'suspended';

export type Company = {
  id: string;
  initials: string;
  name: string;
  status: CompanyStatus;
  statusLabel: string;
  profile: string;
  departments: number;
  accounts: number;
  parcels: string;
  lastActivity: string;
};

/** The clients of the platform, as the application's administrator lists them. */
export const COMPANIES: Company[] = [
  {
    id: 'atelier-lumen',
    initials: 'AL',
    name: 'Atelier Lumen',
    status: 'active',
    statusLabel: 'Active',
    profile: 'Multi-départements',
    departments: 4,
    accounts: 42,
    parcels: '1 284',
    lastActivity: 'Il y a 5 min',
  },
  {
    id: 'maison-ferrand',
    initials: 'MF',
    name: 'Maison Ferrand',
    status: 'active',
    statusLabel: 'Active',
    profile: 'Petit site',
    departments: 1,
    accounts: 6,
    parcels: '412',
    lastActivity: 'Hier, 17:20',
  },
  {
    id: 'cabinet-meran',
    initials: 'CM',
    name: 'Cabinet Méran',
    status: 'active',
    statusLabel: 'Active',
    profile: 'Traçabilité stricte',
    departments: 3,
    accounts: 18,
    parcels: '204',
    lastActivity: 'Aujourd’hui, 9:02',
  },
  {
    id: 'groupe-novalis',
    initials: 'GN',
    name: 'Groupe Novalis',
    status: 'invited',
    statusLabel: 'Invitation envoyée',
    profile: 'Multi-départements',
    departments: 0,
    accounts: 1,
    parcels: '0',
    lastActivity: '—',
  },
  {
    id: 'studio-kerval',
    initials: 'SK',
    name: 'Studio Kerval',
    status: 'suspended',
    statusLabel: 'Suspendue',
    profile: 'Petit site',
    departments: 2,
    accounts: 9,
    parcels: '0',
    lastActivity: 'Il y a 12 jours',
  },
];

export type Department = {
  id: string;
  name: string;
  place: string;
  hours: string;
  accounts: number;
  /** `—` for the mail service, which holds no parcels of its own. */
  present: string;
  coming: string;
};

/** The departments of Atelier Lumen. */
export const DEPARTMENTS: Department[] = [
  {
    id: 'service-courrier',
    name: 'Service courrier',
    place: 'Rez-de-chaussée, quai',
    hours: 'Lun.–ven. 8:00–18:00',
    accounts: 3,
    present: '—',
    coming: '—',
  },
  {
    id: 'studio',
    name: 'Studio',
    place: 'Bât. A, 2e étage, accueil',
    hours: 'Lun.–ven. 9:00–12:30, 14:00–18:00',
    accounts: 12,
    present: '12',
    coming: '6',
  },
  {
    id: 'finance',
    name: 'Finance',
    place: 'Bât. B, 4e étage, bureau 412',
    hours: 'Lun.–jeu. 9:00–17:00',
    accounts: 9,
    present: '8',
    coming: '5',
  },
  {
    id: 'juridique',
    name: 'Juridique',
    place: 'Bât. B, 5e étage, secrétariat',
    hours: 'Lun.–ven. 9:30–17:30',
    accounts: 7,
    present: '17',
    coming: '3',
  },
];

export type Person = {
  name: string;
  initials: string;
  email: string;
  place?: string;
  department?: string;
};

function person(name: string, place?: string, department?: string): Person {
  const parts = name.split(' ');
  return {
    name,
    initials: parts.map((part) => part[0]).join(''),
    email: `${name
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(' ', '.')}@atelier-lumen.fr`,
    place,
    department,
  };
}

/** The people who come back from one mockup to the next. */
export const PEOPLE = {
  julie: person('Julie Perrin', undefined, 'Studio'),
  karim: person('Karim Daoud', undefined, 'Service courrier'),
  sophie: person('Sophie Lambert', undefined, 'Service courrier'),
  claire: person('Claire Bonnet'),
  sam: person('Sam Lefort'),
  thomas: person('Thomas Moreau', undefined, 'Studio'),
  nadia: person('Nadia Kessler', undefined, 'Finance'),
  bruno: person('Bruno Vidal', undefined, 'Juridique'),
  elise: person('Élise Garnier', undefined, 'Finance'),
  axelle: person('Axelle Bernard', '2e étage', 'Studio'),
  antoine: person('Antoine Martin', '2e étage', 'Studio'),
  camille: person('Camille Morel', 'poste 214', 'Studio'),
  hugo: person('Hugo Lefèvre', '2e étage', 'Studio'),
  ines: person('Inès Garnier', '2e étage', 'Studio'),
  jules: person('Jules Perret', '2e étage', 'Studio'),
  mona: person('Mona Aubry', 'poste 220', 'Studio'),
  samuel: person('Samuel Petit', '2e étage', 'Studio'),
  nora: person('Nora Haddad', undefined, 'Studio'),
  lea: person('Léa Fontaine'),
} as const satisfies Record<string, Person>;

export type StudioParcel = {
  id: string;
  recipient: string;
  /** `late` draws the orange dot, `present` the blue one. */
  state: 'present' | 'late';
  status: string;
  carrier: string;
  tracking: string;
  arrived: string;
};

/** The parcels waiting at the Studio, as its table lists them. */
export const STUDIO_PARCELS: StudioParcel[] = [
  {
    id: 'ines',
    recipient: 'Inès Garnier',
    state: 'late',
    status: 'En souffrance',
    carrier: 'FedEx',
    tracking: '8779 7487 3338',
    arrived: 'Lun. 10:56',
  },
  {
    id: 'camille',
    recipient: 'Camille Morel',
    state: 'present',
    status: 'Présent',
    carrier: 'UPS',
    tracking: '1Z E63 44W 04 9923 0622',
    arrived: '10:56',
  },
  {
    id: 'hugo',
    recipient: 'Hugo Lefèvre',
    state: 'present',
    status: 'Présent',
    carrier: 'DHL',
    tracking: '54 1333 7112',
    arrived: '10:56',
  },
  {
    id: 'samuel',
    recipient: 'Samuel Petit',
    state: 'present',
    status: 'Présent',
    carrier: 'Amazon',
    tracking: 'TBA 3011 4471 · 2 colis',
    arrived: '10:56',
  },
  {
    id: 'nora',
    recipient: 'Nora Haddad',
    state: 'present',
    status: 'Présent',
    carrier: 'Amazon',
    tracking: 'TBA 3011 4472',
    arrived: 'Hier',
  },
];

export const SAMPLE_PASSWORD = 'motdepasse12';

export const RECIPIENT_RESULTS = [
  { name: 'Léa Fontaine', initials: 'LF', detail: 'Finance · 4e étage' },
  { name: 'Louis Fontaine', initials: 'LF', detail: 'Studio · 2e étage' },
  { name: 'Lise Fontan', initials: 'LF', detail: 'Juridique · 5e étage' },
];

/** The shell of the company settings pages, open on the tab named `crumb`. */
export function companySettingsShell(crumb: string, company: CompanyShellCompany = COMPANY.admin) {
  return {
    company,
    nav: COMPANY_ADMIN_NAV,
    account: ACCOUNT.companyAdmin,
    breadcrumb: crumbs('Atelier Lumen', 'Entreprise', crumb),
  };
}
