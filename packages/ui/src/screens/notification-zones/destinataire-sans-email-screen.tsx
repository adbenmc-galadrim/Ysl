import { useState } from 'react';

import { Button } from '#components/button';
import { Field, FieldInput } from '#components/field';
import { LargeTitle } from '#components/large-title';
import { NavBar, NavBarAction } from '#components/nav-bar';
import { OptionCard, OptionCardGroup } from '#components/option-card';
import { Screen } from '#components/screen';
import { Sheet } from '#components/sheet';

export type ContactWay = 'email' | 'contact' | 'voice';

export type DestinataireSansEmailScreenProps = {
  recipient: string;
  /** Who they are when the directory does not know: "prestataire au 4e". */
  place: string;
  /** Position in the batch being notified: "2 sur 2". */
  progress: string;
  way: ContactWay;
  email?: string;
};

/**
 * Notifying someone the directory has no e-mail for. Rather than block the
 * batch, the agent picks another way on the spot; typing an address is
 * first because it also fixes the next parcel.
 */
export function DestinataireSansEmailScreen({
  recipient,
  place,
  progress,
  way: initialWay,
  email,
}: DestinataireSansEmailScreenProps) {
  const [way, setWay] = useState(initialWay);
  return (
    <Sheet
      title="Comment le prévenir ?"
      description={`${recipient} n’a pas d’adresse e-mail dans l’annuaire.`}
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
    >
      <OptionCardGroup label="Comment le prévenir ?" className="mt-[22px]">
        <OptionCard
          icon="mail"
          title="Ajouter son e-mail"
          description="Il recevra le QR code et le code"
          selected={way === 'email'}
          onClick={() => setWay('email')}
        />
        <OptionCard
          icon="users"
          title="Prévenir un contact"
          description="Par exemple l’assistante du service"
          selected={way === 'contact'}
          onClick={() => setWay('contact')}
        />
        <OptionCard
          icon="info"
          title="Le prévenir de vive voix"
          description="Le colis reste à notifier jusqu’au retrait"
          selected={way === 'voice'}
          onClick={() => setWay('voice')}
        />
      </OptionCardGroup>
      {way === 'email' && (
        <Field label="Adresse e-mail" className="mt-5">
          {(id) => (
            <FieldInput
              id={id}
              type="email"
              variant="outline"
              defaultValue={email}
              placeholder="prenom.nom@exemple.fr"
            />
          )}
        </Field>
      )}
      <Button block className="mt-[60px]">
        {`Notifier ${recipient}`}
      </Button>
    </Sheet>
  );
}
