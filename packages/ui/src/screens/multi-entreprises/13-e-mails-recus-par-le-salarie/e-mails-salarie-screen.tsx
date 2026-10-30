import { Avatar } from '#components/avatar';
import { IconButton } from '#components/icon-button';
import { QrCode } from '#components/qr-code';
import { Screen } from '#components/screen';
import { Icon, type IconName } from '#icons';
import { cn } from '#lib/tv';

const PICKUP_QR = [
  '#######.......#######',
  '#.....#..##...#.....#',
  '#.###.#.##....#.###.#',
  '#.###.#.##.#..#.###.#',
  '#.###.#..#....#.###.#',
  '#.....#...##..#.....#',
  '#######..#....#######',
  '.........#..#........',
  '...#.#######..#...#.#',
  '#.#######...##.####.#',
  '....####...##...#....',
  '###.#####....#..#.#..',
  '#.....#.#...#.#.####.',
  '.........####.######.',
  '#######.##...####..##',
  '#.....#.#..#.##.#.#.#',
  '#.###.#....##.####.##',
  '#.###.#....###.#####.',
  '#.###.#..#.##.#.#....',
  '#.....#...##.###.##.#',
  '#######..#...###..#.#',
];

const PARCELS = ['Amazon ···4471', 'Amazon ···4472'];

export type EmployeeMail = {
  company: { name: string; initials: string; ownLogo: boolean };
  sender: string;
  subject: string;
  /** The subject as the computer's wider header shows it. */
  deskSubject: string;
  sentAt: string;
  heading: string;
  greeting: string;
  /** Without a QR, the code alone fills the block. */
  codeOnly?: boolean;
  /** A department with no opening hours leaves out the « Quand » line. */
  hours?: string;
};

const LUMEN = { name: 'Atelier Lumen', initials: 'AL', ownLogo: true };
const HOURS = 'Lun.–ven. 9:00–12:30, 14:00–18:00';

export const NOTICE_MAIL: EmployeeMail = {
  company: LUMEN,
  sender: 'Courrier Atelier Lumen',
  subject: '2 colis vous attendent au Studio',
  deskSubject: '2 colis vous attendent au Studio',
  sentAt: 'aujourd’hui 10:58',
  heading: '2 colis vous attendent au Studio',
  greeting:
    'Bonjour Nora, ils sont arrivés ce matin. Présentez ce QR code ou donnez le code au point de réception.',
  hours: HOURS,
};

export const CODE_ONLY_MAIL: EmployeeMail = { ...NOTICE_MAIL, codeOnly: true };

export const NO_LOGO_MAIL: EmployeeMail = {
  ...NOTICE_MAIL,
  company: { name: 'Maison Ferrand', initials: 'MF', ownLogo: false },
  sender: 'Accueil Maison Ferrand',
  greeting:
    'Bonjour Paul, ils sont arrivés ce matin. Présentez ce QR code ou donnez le code au point de réception.',
  hours: undefined,
};

export const REMINDER_MAIL: EmployeeMail = {
  company: LUMEN,
  sender: 'Courrier Atelier Lumen',
  subject: 'Rappel : vos 2 colis attendent',
  deskSubject: 'Rappel : vos 2 colis attendent au Studio',
  sentAt: 'mercredi 9:00',
  heading: 'Vos 2 colis attendent toujours',
  greeting:
    'Bonjour Nora, vos colis sont au Studio depuis lundi. Passez les retirer, ou prévenez si vous êtes absent.',
  hours: HOURS,
};

function PickupBlock({ codeOnly }: { codeOnly?: boolean }) {
  if (codeOnly) {
    return (
      <div className="flex h-[150px] flex-col items-center rounded-[14px] bg-fill pt-9">
        <span className="relative -top-px text-13 text-muted">Code de retrait</span>
        <span className="mt-2 font-mono text-[48px] leading-[58px] font-bold tracking-[6px]">
          4821
        </span>
      </div>
    );
  }
  return (
    <div className="flex h-[150px] rounded-[14px] bg-fill p-4">
      <QrCode
        matrix={PICKUP_QR}
        module={118 / 21}
        label="QR code de retrait 4821"
        className="rounded-none p-0"
      />
      <div className="ml-4 flex flex-col pt-6">
        <span className="relative -top-px text-13 text-muted">Code de retrait</span>
        <span className="mt-1.5 font-mono text-[40px] leading-12 font-bold tracking-[4px]">
          4821
        </span>
      </div>
    </div>
  );
}

function PracticalRow({
  icon,
  label,
  value,
  pitch,
}: {
  icon: IconName;
  label: string;
  value: string;
  pitch: string;
}) {
  return (
    <div className={cn('flex items-start text-14', pitch)}>
      <Icon name={icon} size={18} className="mt-px shrink-0 text-ink-2" />
      <span className="relative -top-px ml-2.5 w-[82px] shrink-0 font-semibold">
        {label}
      </span>
      <span className="relative -top-px text-ink-2">{value}</span>
    </div>
  );
}

function MailBody({ mail, desk = false }: { mail: EmployeeMail; desk?: boolean }) {
  const pitch = desk ? 'h-[30px]' : 'h-11';
  return (
    <>
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'flex size-10 items-center justify-center rounded-[8px] text-16 font-bold',
            !desk && 'pb-px',
            mail.company.ownLogo ? 'bg-ink text-on-ink' : 'bg-fill-2 text-ink',
          )}
        >
          {mail.company.initials}
        </span>
        <span className="text-15 font-semibold">{mail.company.name}</span>
      </div>
      <h2
        className={cn(
          'mt-8 font-bold tracking-[-0.3px]',
          desk ? 'text-[28px] leading-[34px]' : 'relative -top-px text-24',
        )}
      >
        {mail.heading}
      </h2>
      <p
        className={cn(
          'text-16 leading-[1.45] text-ink-2',
          desk ? 'mt-3.5 h-[60px]' : 'mt-[41px] h-[96px] w-[349px]',
        )}
      >
        {mail.greeting}
      </p>
      <PickupBlock codeOnly={mail.codeOnly} />
      <div className="mt-6">
        <PracticalRow
          icon="pin"
          label="Où"
          value="Bât. A, 2e étage, accueil"
          pitch={pitch}
        />
        {mail.hours && (
          <PracticalRow
            icon="clock"
            label="Quand"
            value={mail.hours}
            pitch={pitch}
          />
        )}
        <PracticalRow
          icon="info"
          label="À savoir"
          value="Sonnez si l’accueil est fermé."
          pitch={pitch}
        />
      </div>
      <hr className="mt-2.5 border-separator" />
      <ul className="mt-[17px]">
        {PARCELS.map((parcel) => (
          <li key={parcel} className="flex h-[26px] text-14">
            <span className="relative -top-px w-[150px] shrink-0 font-semibold">
              {parcel}
            </span>
            <span className="relative -top-px text-muted">arrivé lundi 10:56</span>
          </li>
        ))}
      </ul>
      <p className="relative -top-px mt-[12px] text-13 text-muted">
        Un collègue peut retirer pour vous : transférez-lui cet e-mail.
      </p>
      <hr className="mt-6 border-separator" />
      <p className="mt-[15px] text-12 text-muted">
        Envoyé par Courrier pour {mail.company.name}. Une question ? Répondez :
        votre message arrive au Studio.
      </p>
    </>
  );
}

/** A pickup e-mail open in the employee's mail client, on the computer. */
export function EmployeeMailDesktop({ mail }: { mail: EmployeeMail }) {
  return (
    <div className="min-h-dvh bg-fill-2 text-ink">
      <header className="h-[120px] border-b border-separator bg-surface pt-6 pl-10">
        <h1 className="text-20 font-bold">{mail.deskSubject}</h1>
        <div className="mt-3.5 flex">
          <Avatar
            initials="AL"
            tone="fill"
            className="size-9 rounded-full bg-fill-2 text-12"
          />
          <div className="ml-3 flex flex-col">
            <span className="relative -top-px text-14 font-semibold">
              Courrier Atelier Lumen {'<courrier@atelier-lumen.fr>'}
            </span>
            <span className="relative -top-px mt-[3px] text-13 text-muted">
              à nora.haddad@atelier-lumen.fr · {mail.sentAt}
            </span>
          </div>
        </div>
      </header>
      <article className="mx-auto mt-8 h-[682px] w-[600px] rounded-[12px] bg-surface p-10 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
        <MailBody mail={mail} desk />
      </article>
    </div>
  );
}

/** The same e-mail in the phone's mail client, cut by the screen as it scrolls. */
export function EmployeeMailMobile({ mail }: { mail: EmployeeMail }) {
  return (
    <Screen className="pt-[calc(var(--safe-top)+6px)]">
      <div className="flex h-11 items-center">
        <IconButton
          icon="back"
          label="Boîte de réception"
          size="lg"
          iconSize={22}
          className="-ml-0.5"
        />
        <span className="ml-1.5 text-17">Boîte de réception</span>
      </div>
      <p className="mt-3 text-15 font-semibold">{mail.sender}</p>
      <p className="relative -top-px mt-1 text-13 text-muted">
        à moi · {mail.sentAt}
      </p>
      <h1 className="mt-2.5 text-20 font-bold">{mail.subject}</h1>
      <hr className="mt-[34px] border-separator" />
      <article className="mt-[27px] pb-5">
        <MailBody mail={mail} />
      </article>
    </Screen>
  );
}
