import { IconButton } from '#components/icon-button';
import { NavBar } from '#components/nav-bar';
import { DoneDisc, PersonAvatar, PhoneBanner, PhoneRow, ProofCard, TickMark } from '#components/phone-parts';
import { Screen } from '#components/screen';
import { SearchField } from '#components/search-field';
import { PhoneAction } from '#screens/multi-entreprises/11-remise-au-salarie/remise-parts';

/** Someone else collects: the employee or a colleague of the department. */
export function QuiRetireMobile() {
  return (
    <Screen bottom={<PhoneAction>Continuer</PhoneAction>}>
      <NavBar
        leading={<IconButton icon="x" label="Fermer" size="lg" iconSize={22} className="-ml-0.5" />}
        title="Qui retire ?"
      />
      <h1 className="mt-3 text-22 font-bold">Colis de Nora Haddad</h1>
      <SearchField
        placeholder="Chercher dans le Studio"
        className="mt-[18px] shrink-0 gap-2 rounded-[12px] pl-3"
      />
      <div className="mt-4">
        <PhoneRow leading={<PersonAvatar initials="NH" />} title="Nora Haddad" lines={['Destinataire']} mark={<TickMark />} separator />
        <PhoneRow leading={<PersonAvatar initials="JF" />} title="Julien Faure" lines={['Studio · collègue']} separator />
        <PhoneRow leading={<PersonAvatar initials="CR" />} title="Camille Roux" lines={['Studio · collègue']} />
      </div>
      <PhoneBanner
        icon="lock"
        iconClassName="text-ink-2"
        title="Seulement un collègue du Studio"
        description="Réglage d’Atelier Lumen ; une signature est demandée."
        height={83}
        className="mt-5"
      />
    </Screen>
  );
}

/** A colleague has signed for the employee, who is told by e-mail. */
export function RetireParCollegueMobile() {
  return (
    <Screen bottom={<PhoneAction>Terminé</PhoneAction>}>
      <DoneDisc />
      <h1 className="mt-6 text-center text-26 font-bold">Remis à Julien Faure</h1>
      <p className="mt-[9px] text-center text-15 text-muted">
        pour Nora Haddad · Studio · 11:24
      </p>
      <ProofCard
        items={[
          { icon: 'user', label: 'Collègue du Studio vérifié' },
          { icon: 'sign', label: 'Signature de Julien Faure' },
          { icon: 'mail', label: 'Nora Haddad prévenue par e-mail' },
        ]}
      />
    </Screen>
  );
}
