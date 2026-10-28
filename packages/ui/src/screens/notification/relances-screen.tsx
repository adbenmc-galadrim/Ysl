import { BottomBar } from '#components/bottom-bar';
import { Button, buttonVariants } from '#components/button';
import { EmptyState } from '#components/empty-state';
import { IconTile } from '#components/icon-tile';
import { ListRow } from '#components/list-row';
import { NavBar } from '#components/nav-bar';
import { Screen } from '#components/screen';
import { SectionHeader } from '#components/section-header';

export type ReminderPerson = {
  id: string;
  name: string;
  /** Their parcels: "2 colis · FedEx ···3338, DHL ···7112". */
  parcels: string;
  /** Since when, and the reminders already sent: "En attente depuis 8 jours · relancé 2 fois, le 22 oct.". */
  status: string;
  /** A reminder is due by the rule; otherwise both went and the parcels wait on. */
  due: boolean;
};

export type RelancesSection = { title: string; people: ReminderPerson[] };

export type RelancesScreenProps = {
  sections: RelancesSection[];
  /** Under the title: the rhythm, and that nothing leaves by itself. */
  intro?: string;
  /** Said when nobody is to remind. */
  empty?: { title: string; description?: string };
  /** One person's reminder, opened in Notifier. */
  onRemind?: (person: ReminderPerson) => void;
  /** "Relancer les 3": every reminder due, one mail per person. */
  remindAllLabel?: string;
  onRemindAll?: () => void;
  onBack?: () => void;
};

/**
 * The parcels nobody came for (F37, P5), by person: those a reminder is
 * due for (J+2, J+5 working days, D12), then those both reminders went to.
 * The app prepares the reminders, the agent sends each one (D2). No mockup
 * draws this list: it takes the frame of « E-mails envoyés ».
 */
export function RelancesScreen({
  sections,
  intro,
  empty,
  onRemind,
  remindAllLabel,
  onRemindAll,
  onBack,
}: RelancesScreenProps) {
  const shown = sections.filter((section) => section.people.length > 0);
  return (
    <Screen
      bottom={
        onRemindAll &&
        remindAllLabel && (
          <BottomBar>
            <Button block onClick={onRemindAll}>
              {remindAllLabel}
            </Button>
          </BottomBar>
        )
      }
    >
      <NavBar title="Colis en souffrance" onBack={onBack} />
      {intro && (
        <p className="mt-2 text-15 leading-[1.4] text-muted">{intro}</p>
      )}
      {shown.length === 0 && empty && (
        <EmptyState
          icon="clock"
          title={empty.title}
          description={empty.description}
          className="mt-[129px]"
        />
      )}
      {shown.map((section, s) => (
        <section key={section.title} className={s ? 'mt-[29px]' : 'mt-6'}>
          <SectionHeader title={section.title} count={section.people.length} />
          <div className="mt-6">
            {section.people.map((person, i) => (
              <ListRow
                key={person.id}
                leading={
                  <IconTile icon="clock" tone={person.due ? 'orange' : 'red'} />
                }
                title={person.name}
                lines={[
                  { text: person.parcels },
                  {
                    text: <span className="font-normal">{person.status}</span>,
                    tone: person.due ? 'orange' : 'red',
                  },
                ]}
                trailing={
                  <span
                    aria-hidden="true"
                    className={buttonVariants({
                      variant: person.due ? 'warning' : 'secondary',
                      size: 'xs',
                      class: 'w-[89px]',
                    })}
                  >
                    Relancer
                  </span>
                }
                separator={i < section.people.length - 1}
                onClick={onRemind && (() => onRemind(person))}
              />
            ))}
          </div>
        </section>
      ))}
    </Screen>
  );
}
