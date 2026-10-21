import { useState } from 'react';

import { Banner } from '#components/banner';
import { Button } from '#components/button';
import { Chip, ChipGroup } from '#components/chip';
import { LargeTitle } from '#components/large-title';
import { NavBar } from '#components/nav-bar';
import { Screen } from '#components/screen';
import { Sheet } from '#components/sheet';
import { Switch } from '#components/switch';

export type ColisEnSouffranceScreenProps = {
  recipient: string;
  /** "Ressources humaines, FedEx ···3338". */
  detail: string;
  carrier: string;
  /** "En attente depuis 8 jours". */
  waiting: string;
  /** "Deux relances sans réponse." */
  reminders: string;
  reasons: string[];
  reason: string;
  sender: string;
  notifyRecipient?: boolean;
};

/**
 * A parcel nobody came for. The return is prepared from here — reason,
 * sender, whether to tell the recipient — so the shelf does not fill up
 * with parcels that are never collected.
 */
export function ColisEnSouffranceScreen({
  recipient,
  detail,
  carrier,
  waiting,
  reminders,
  reasons,
  reason: initialReason,
  sender,
  notifyRecipient = true,
}: ColisEnSouffranceScreenProps) {
  const [reason, setReason] = useState(initialReason);
  const [notify, setNotify] = useState(notifyRecipient);
  return (
    <Sheet
      title="Retour à l’expéditeur"
      behind={
        <Screen>
          <NavBar />
          <LargeTitle
            size="record"
            title={recipient}
            subtitle={detail}
            className="mt-3.5"
          />
        </Screen>
      }
    >
      {/* Both cards keep the height Penpot gives them; their last line
          is allowed to run to the edge, as drawn. */}
      <Banner
        tone="red"
        icon="clock"
        title={waiting}
        description={reminders}
        className="mt-2.5 h-16"
      />
      <p className="mt-4 text-13 font-medium text-muted">Motif</p>
      <ChipGroup label="Motif" className="mt-1.5">
        {reasons.map((r) => (
          <Chip key={r} selected={r === reason} onClick={() => setReason(r)}>
            {r}
          </Chip>
        ))}
      </ChipGroup>
      <p className="mt-[22px] text-13 font-medium text-muted">Expéditeur</p>
      <p className="mt-1 text-17 font-medium">{sender}</p>
      <div className="mt-5 flex h-[60px] items-center justify-between gap-3 rounded-control bg-fill px-4">
        <span id="notify-label" className="text-16">
          {`Prévenir ${recipient} du retour`}
        </span>
        <Switch
          checked={notify}
          onCheckedChange={setNotify}
          aria-labelledby="notify-label"
        />
      </div>
      <Banner
        tone="blue"
        icon="info"
        title={`Étiquette retour à demander à ${carrier}`}
        description="Le colis passe en « Retour en cours » jusqu’à l’enlèvement."
        className="mt-3.5 h-[72px]"
      />
      <div className="mt-[76px] flex gap-3">
        <Button
          variant="secondary"
          icon="phone"
          iconSize={20}
          className="w-[120px] gap-2 px-0 text-16"
        >
          Appeler
        </Button>
        <Button className="min-w-0 flex-1">Préparer le retour</Button>
      </div>
    </Sheet>
  );
}
