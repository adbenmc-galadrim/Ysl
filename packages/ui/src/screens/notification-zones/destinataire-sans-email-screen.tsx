import { useState } from 'react';

import { LargeTitle } from '#components/large-title';
import { NavBar, NavBarAction } from '#components/nav-bar';
import { Screen } from '#components/screen';
import {
  NotifyWaySheet,
  type ContactWay,
} from '#screens/notification-zones/notify-way-sheet';

export type DestinataireSansEmailScreenProps = {
  recipient: string;
  /** Who they are when the directory does not know: "prestataire au 4e". */
  place: string;
  /** Position in the batch being notified: "2 sur 2". */
  progress: string;
  way: ContactWay;
  email?: string;
};

/** The sheet over the round it interrupts, as the maquette draws it. */
export function DestinataireSansEmailScreen({
  recipient,
  place,
  progress,
  way: initialWay,
  email,
}: DestinataireSansEmailScreenProps) {
  const [way, setWay] = useState(initialWay);
  return (
    <NotifyWaySheet
      recipient={recipient}
      way={way}
      onWayChange={setWay}
      email={{ value: email ?? '' }}
      relay={{ chooseLabel: 'Choisir le contact' }}
      voiceNote={`Donnez-lui son code de retrait : ses colis passent « Notifié ».`}
      confirmLabel={`Notifier ${recipient}`}
      behind={
        <Screen>
          <NavBar
            title={progress}
            trailing={<NavBarAction>Passer</NavBarAction>}
          />
          <LargeTitle
            size="md"
            title={recipient}
            subtitle={place}
            className="mt-3 gap-1"
          />
        </Screen>
      }
    />
  );
}
