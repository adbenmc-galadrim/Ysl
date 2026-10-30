import { Button } from '#components/button';
import { CompanyShell, DeskPageHeader } from '#components/company-shell';
import { DeskFilterButton } from '#components/desk-filter';
import {
  DeskTable,
  DeskTablePagination,
  type DeskTableColumn,
} from '#components/desk-table';
import { StatusDot, type StatusDotProps } from '#components/status-dot';
import {
  ACCOUNT,
  COMPANY,
  COMPANY_ADMIN_NAV,
  crumbs,
} from '#fixtures/multi-entreprises';

const FIGURES = [
  { label: 'En route', value: '14', left: 16 },
  { label: 'En attente de retrait', value: '37', left: 246 },
  { label: 'En souffrance', value: '5', left: 477, tone: 'text-orange' },
  { label: 'À régulariser', value: '3', left: 707, tone: 'text-red' },
  { label: 'Remis aujourd’hui', value: '22', left: 938 },
];

type CompanyParcel = {
  recipient: string;
  department: string;
  tone: StatusDotProps['tone'];
  status: string;
  carrier: string;
  tracking: string;
  received: string;
  shuttle: string;
  email: string;
};

const row = (
  recipient: string,
  department: string,
  tone: StatusDotProps['tone'],
  status: string,
  carrier: string,
  tracking: string,
  received: string,
  shuttle: string,
  email: string,
): CompanyParcel => ({
  recipient,
  department,
  tone,
  status,
  carrier,
  tracking,
  received,
  shuttle,
  email,
});

const PARCELS: CompanyParcel[] = [
  row('Léa Fontaine', 'Finance', 'red', 'À régulariser', 'Colissimo', '8J 02299 07975 0', '10:40', 'KD', '—'),
  row('Inès Garnier', 'Studio', 'orange', 'En souffrance', 'FedEx', '8779 7487 3338', 'Lun.', 'KD', 'Relancée hier'),
  row('Camille Morel', 'Studio', 'blue', 'En attente de retrait', 'UPS', '1Z E63 44W 04 9923 0622', '10:42', 'KD', 'Délivré'),
  row('Hugo Lefèvre', 'Studio', 'blue', 'En attente de retrait', 'DHL', '54 1333 7112', '08:51', 'SL', 'Délivré'),
  row('Paul Mercier', 'Juridique', 'ink', 'En route', 'DPD', '1046 4000 2094 04', '09:30', 'SL', 'Au dépôt'),
  row('Nora Haddad', 'Finance', 'ink', 'En route', 'Amazon', 'TBA 3011 4471', '10:15', 'KD', 'Au dépôt'),
  row('Malik Benali', 'Juridique', 'green', 'Remis', 'Chronopost', 'HA 9153 0663 1JB', '09:12', 'KD', 'Remis 11:05'),
  row('Axelle Bernard', 'Studio', 'green', 'Remis', 'UPS', '1Z 88A 21W 04 1188 2210', '08:40', 'SL', 'Remis 09:58'),
  row('Romain Garnier', 'Finance', 'green', 'Remis', 'UPS', '1Z 7A1 90X 04 2201 7731', 'Hier', 'SL', 'Remis 17:12'),
  row('Lucie Hamel', 'Juridique', 'green', 'Remis', 'DHL', '54 9921 0042', 'Hier', 'KD', 'Remis 16:40'),
];

const COLUMNS: DeskTableColumn<CompanyParcel>[] = [
  {
    key: 'recipient',
    header: 'Destinataire',
    width: 170,
    cell: (p) => <span className="font-semibold">{p.recipient}</span>,
  },
  { key: 'department', header: 'Département', width: 130, cell: (p) => p.department },
  {
    key: 'status',
    header: 'Statut',
    width: 170,
    cell: (p) => <StatusDot size="sm" tone={p.tone} label={p.status} />,
  },
  { key: 'carrier', header: 'Transporteur', width: 110, cell: (p) => p.carrier },
  {
    key: 'tracking',
    header: 'Suivi',
    width: 220,
    cell: (p) => <span className="mt-0.5 font-mono text-12 whitespace-pre">{p.tracking}</span>,
  },
  { key: 'received', header: 'Reçu', width: 100, cell: (p) => p.received },
  { key: 'shuttle', header: 'Navette', width: 90, cell: (p) => p.shuttle },
  {
    key: 'email',
    header: 'E-mail',
    cell: (p) => <span className="text-muted">{p.email}</span>,
  },
];

/** Every parcel of the company, across departments, with its five figures. */
export function AdminColisDesktop() {
  return (
    <CompanyShell
      company={COMPANY.admin}
      nav={COMPANY_ADMIN_NAV}
      active="colis"
      account={ACCOUNT.companyAdmin}
      breadcrumb={crumbs('Atelier Lumen', 'Colis')}
      searchPlaceholder="Nom, suivi, transporteur"
    >
      <DeskPageHeader
        title="Colis"
        subtitle="Tous les départements · mis à jour à 10:52"
        actions={
          <Button
            variant="outline"
            size="desk"
            icon="download"
            className="w-[104px] justify-start"
          >
            Exporter
          </Button>
        }
      />
      <div className="relative mt-2 h-[76px] shrink-0 rounded-desk border border-separator">
        {FIGURES.map((figure, i) => (
          <div key={figure.label}>
            {i > 0 && (
              <span
                className="absolute top-[11px] h-[52px] w-px bg-separator"
                style={{ left: 229.4 + (i - 1) * 230.4 }}
              />
            )}
            <div className="absolute top-[11px]" style={{ left: figure.left - 1 }}>
              <p className="text-12 font-medium text-muted">{figure.label}</p>
              <p className={`mt-[5px] text-22 font-bold ${figure.tone ?? ''}`}>
                {figure.value}
              </p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 flex gap-2">
        <DeskFilterButton label="Statut" value="Tous" className="w-[110px]" />
        <DeskFilterButton label="Département" value="Tous" className="w-[150px]" />
        <DeskFilterButton label="Reçu" value="7 derniers jours" className="w-[180px]" />
      </div>
      <DeskTable
        label="Colis de l’entreprise"
        className="mt-3"
        columns={COLUMNS}
        rows={PARCELS}
        rowKey={(p) => p.recipient}
        selectable
        footer={<DeskTablePagination range="1–10 sur 81" />}
      />
    </CompanyShell>
  );
}
