import { BottomBar } from '#components/bottom-bar';
import { Button } from '#components/button';
import { CompanyShell, DeskPageHeader } from '#components/company-shell';
import { DeskTable, type DeskTableColumn } from '#components/desk-table';
import { GroupedHeader } from '#components/grouped-list';
import { NavBar } from '#components/nav-bar';
import { PhoneBanner } from '#components/phone-parts';
import { Screen } from '#components/screen';
import { ACCOUNT, COMPANY, COMPANY_ADMIN_NAV, crumbs } from '#fixtures/multi-entreprises';
import { Icon } from '#icons';
import { cn } from '#lib/tv';
import {
  DepositGroup,
  DepositTimeline,
} from '#screens/multi-entreprises/09-depot-au-departement/deposit-parts';

type Blocked = {
  id: string;
  name: string;
  department: string;
  cause: string;
  since: string;
};

const BLOCKED: Blocked[] = [
  {
    id: 'lea',
    name: 'Léa Fontaine',
    department: 'Finance',
    cause: 'Manquant au dépôt de 9:40',
    since: 'Il y a 1 h',
  },
  {
    id: 'ines',
    name: 'Inès Garnier',
    department: 'Studio',
    cause: 'Manquant au dépôt de 10:56',
    since: 'Il y a 20 min',
  },
  {
    id: 'paul',
    name: 'Paul Mercier',
    department: 'Juridique',
    cause: 'Salarié parti de l’entreprise',
    since: 'Hier',
  },
];

const COLUMNS: DeskTableColumn<Blocked>[] = [
  {
    key: 'name',
    header: 'Destinataire',
    width: 160,
    cell: (b) => <span className="font-semibold">{b.name}</span>,
  },
  { key: 'department', header: 'Département', width: 130, cell: (b) => b.department },
  {
    key: 'cause',
    header: 'Cause',
    width: 280,
    cell: (b) => <span className="text-ink-2">{b.cause}</span>,
  },
  {
    key: 'since',
    header: 'Depuis',
    cell: (b) => <span className="text-muted">{b.since}</span>,
  },
];

const OPTIONS = [
  'Retrouvé, le redéposer à Finance',
  'Réaffecter à un autre département',
  'Retourner à l’expéditeur',
  'Perdu : clore le colis',
];

/** The blocked parcels of the company, and the record of the one open. */
export function AdminRegulariserDesktop() {
  return (
    <CompanyShell
      company={COMPANY.admin}
      nav={COMPANY_ADMIN_NAV}
      active="colis"
      account={ACCOUNT.companyAdmin}
      breadcrumb={crumbs('Atelier Lumen', 'Colis', 'À régulariser')}
    >
      <DeskPageHeader title="À régulariser" subtitle="3 colis bloqués" />
      <div className="flex items-start gap-4">
        <DeskTable
          label="Colis à régulariser"
          className="w-[776px] shrink-0"
          columns={COLUMNS}
          rows={BLOCKED}
          rowKey={(b) => b.id}
          activeRow="lea"
        />
        <aside className="flex h-[640px] w-[360px] shrink-0 flex-col rounded-desk border border-separator p-[15px]">
          <h2 className="text-16 font-bold">Léa Fontaine</h2>
          <p className="mt-[3px] font-mono text-12 text-muted">
            Colissimo · 8J 02299 07975 0
          </p>
          <div className="relative mt-4 h-[60px] shrink-0 rounded-[6px] bg-red-soft pt-2.5 pl-9 text-red">
            <Icon name="warning" size={16} className="absolute top-3 left-3" />
            <p className="text-13 font-semibold">Manquant au dépôt de 9:40</p>
            <p className="mt-[5px] text-12">
              Finance a compté 4 colis sur 5 (Nadia Kessler).
            </p>
          </div>
          <DepositTimeline
            size="desk"
            className="mt-5"
            steps={[
              { title: 'Reçu et scanné', detail: '8:31, Karim' },
              { title: 'En route vers Finance', detail: '9:12' },
              {
                title: 'Écart au dépôt',
                detail: '9:40, Nadia Kessler',
                alert: true,
              },
            ]}
          />
          <div className="-mx-[15px] mt-2.5 h-px shrink-0 bg-separator" />
          <p className="relative -top-px mt-[15px] text-13 font-semibold">Que faire ?</p>
          <div role="radiogroup" aria-label="Que faire ?" className="mt-3">
            {OPTIONS.map((option, i) => (
              <div key={option} className="flex h-10 items-start gap-2.5 text-13">
                <span
                  className={cn(
                    '-m-[0.5px] mt-[1.5px] flex size-[17px] shrink-0 items-center justify-center rounded-full border-[1.5px]',
                    i === 0 ? 'border-ink bg-ink' : 'border-border',
                  )}
                >
                  {i === 0 && <span className="size-1.5 rounded-full bg-on-ink" />}
                </span>
                <span className="relative -top-px">{option}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-12 text-muted">
            La navette Karim Daoud sera prévenue.
          </p>
          <Button size="desk" className="mt-16 w-full">
            Valider
          </Button>
        </aside>
      </div>
    </CompanyShell>
  );
}

/** The same decision on the phone, for one parcel. */
export function AdminRegulariserMobile() {
  return (
    <Screen
      tone="fill"
      bottom={
        <BottomBar surface="plain" className="pt-6 pb-9">
          <Button block>Valider</Button>
        </BottomBar>
      }
    >
      <NavBar title="Léa Fontaine" />
      <PhoneBanner
        tone="red"
        icon="warning"
        className="mt-3"
        title="Manquant au dépôt de 9:40"
        description="Finance a compté 4 colis sur 5."
        height={67}
      />
      <GroupedHeader className="relative -top-px mt-[27px]">Que faire ?</GroupedHeader>
      <DepositGroup
        tone="surface"
        className="mt-1.5"
        items={[
          {
            title: <span className="font-semibold">Retrouvé, le redéposer</span>,
            trailing: <Icon name="tick" size={16} className="-mr-0.5" />,
            textTop: 17,
          },
          { title: 'Réaffecter à un département', chevron: true, textTop: 17 },
          { title: 'Retourner à l’expéditeur', chevron: true, textTop: 16 },
          { title: <span className="text-red">Perdu : clore le colis</span> },
        ]}
      />
    </Screen>
  );
}
