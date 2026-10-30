import { BottomBar } from '#components/bottom-bar';
import { Button } from '#components/button';
import { Screen } from '#components/screen';
import { Icon } from '#icons';
import {
  DeskAuthPage,
  DeskField,
  LogoTile,
  PhoneField,
  SAMPLE_PASSWORD,
} from '#screens/multi-entreprises/01-premier-lancement-et-connexion/auth-parts';

function Rule({ children }: { children: string }) {
  return (
    <li className="flex items-center gap-2 text-14 text-ink-2">
      <Icon name="tick" size={16} className="shrink-0 text-green" />
      <span className="relative -top-px">{children}</span>
    </li>
  );
}

function DeskRule({ children }: { children: string }) {
  return (
    <li className="flex items-center gap-2 text-13 text-ink-2">
      <Icon name="tick" size={14} className="relative top-px shrink-0 text-green" />
      {children}
    </li>
  );
}

/** The invitation as read in a mail client on the computer. */
export function InvitationEmailDesktop() {
  return (
    <div className="relative h-dvh w-full overflow-hidden bg-fill-2 text-ink">
      <header className="relative h-[120px] border-b border-separator bg-surface pt-6 pl-10">
        <h1 className="text-20 font-bold">
          Votre compte Département Studio chez Atelier Lumen
        </h1>
        <span className="absolute top-[62px] left-10 flex size-9 items-center justify-center rounded-full bg-fill-2 text-12 font-semibold">
          AL
        </span>
        <p className="absolute top-[61px] left-[88px] text-14 font-semibold">
          Courrier Atelier Lumen &lt;courrier@atelier-lumen.fr&gt;
        </p>
        <p className="absolute top-[81px] left-[88px] text-13 text-muted">
          à julie.perrin@atelier-lumen.fr · lundi 9:12
        </p>
      </header>
      <article className="absolute top-[152px] left-[420px] h-[418px] w-[600px] rounded-[12px] bg-surface px-10 pt-10 shadow-[0_2px_8px_rgb(0_0_0/0.06)]">
        <div className="flex items-center gap-3">
          <LogoTile className="size-10 rounded-[8px] text-16">AL</LogoTile>
          <span className="text-15 font-semibold">Atelier Lumen</span>
        </div>
        <h2 className="relative -top-px mt-8 text-28 font-bold tracking-[-0.3px]">
          Votre compte Département Studio
        </h2>
        <p className="mt-3.5 text-16 leading-[1.45] text-ink-2">
          Claire Bonnet vous a ouvert un compte pour suivre les colis du Studio :
          confirmer les dépôts et remettre les colis aux salariés.
        </p>
        <Button size="md" className="mt-3.5 h-12 w-[260px] rounded-[24px]">
          Créer mon mot de passe
        </Button>
        <p className="relative -top-px mt-6 text-13 text-muted">
          Ce lien est valable 7 jours et ne sert qu’une fois. Identifiant :
          julie.perrin@atelier-lumen.fr
        </p>
        <div className="mt-11 h-px bg-separator" />
        <p className="mt-[15px] text-12 text-muted">
          Envoyé par Courrier pour Atelier Lumen. Une question ? Répondez : votre
          message arrive au Studio.
        </p>
      </article>
    </div>
  );
}

/** The invitation as read in the phone's mail app. */
export function InvitationEmailMobile() {
  return (
    <Screen className="px-0 pt-14">
      <div className="flex items-center pl-[18px]">
        <span className="flex size-11 items-center justify-center rounded-full bg-fill">
          <Icon name="back" size={22} />
        </span>
        <span className="ml-1.5 text-17 leading-[21px]">Boîte de réception</span>
      </div>
      <div className="px-5">
        <p className="mt-4 text-15 font-semibold">Courrier pour Atelier Lumen</p>
        <p className="relative -top-px mt-1 text-13 text-muted">
          invitation@atelier-lumen.fr · à 9:12
        </p>
        <h1 className="mt-2.5 text-20 font-bold">
          Votre compte Navette chez Atelier Lumen
        </h1>
        <div className="mt-2.5 h-px bg-separator" />
      </div>
      <article className="px-6">
        <div className="mt-[35px] flex items-center gap-3">
          <LogoTile className="size-11 rounded-[11px] text-18">AL</LogoTile>
          <span className="relative -top-px text-15 font-semibold">Atelier Lumen</span>
        </div>
        <h2 className="relative -top-px mt-7 text-24 font-bold">Bienvenue sur Courrier</h2>
        <p className="mt-[13px] text-15 leading-[1.45] text-ink-2">
          Claire Bonnet vous a créé un compte Navette chez Atelier Lumen. Vous y
          scannerez les colis reçus et les déposerez aux départements.
        </p>
        <Button size="md" className="mt-[43px] h-12 w-[260px] rounded-[24px]">
          Créer mon mot de passe
        </Button>
        <p className="mt-[19px] text-13 text-muted">
          Ce lien est valable 7 jours et ne sert qu’une fois.
        </p>
        <div className="mt-[27px] h-px bg-separator" />
        <p className="mt-4 text-13 text-muted">
          Votre identifiant : karim.daoud@atelier-lumen.fr
        </p>
        <p className="mt-[9px] text-13 leading-[1.2] text-muted">
          Vous n’attendiez pas cet e-mail ? Ignorez-le : aucun compte ne sera
          activé.
        </p>
        <p className="mt-[87px] text-12 text-faint">
          Envoyé par Courrier pour Atelier Lumen
        </p>
      </article>
    </Screen>
  );
}

/** The password an invited account chooses, on the computer. */
export function CreerMotDePasseDesktop() {
  return (
    <DeskAuthPage
      logo="AL"
      brand="Atelier Lumen"
      product="avec Courrier"
      footer="Une question ? Écrivez à Claire Bonnet, administratrice d’Atelier Lumen."
    >
      <h1 className="text-26 font-bold tracking-[-0.3px]">
        Créer votre mot de passe
      </h1>
      <p className="mt-1.5 text-14 text-muted">
        Julie Perrin · département Studio
      </p>
      <DeskField label="Mot de passe" value={SAMPLE_PASSWORD} className="mt-[34px]" />
      <DeskField
        label="Confirmer le mot de passe"
        value={SAMPLE_PASSWORD}
        focused
        className="mt-4"
      />
      <ul className="mt-[19px] flex flex-col gap-2">
        <DeskRule>12 caractères au moins</DeskRule>
        <DeskRule>Les deux sont identiques</DeskRule>
      </ul>
      <Button className="mt-[29px] h-10 w-full rounded-[6px] text-14">
        <span className="relative -top-0.5">Créer mon mot de passe</span>
      </Button>
      <p className="mt-4 text-12 text-muted">
        Ce lien d’invitation expire le 5 novembre.
      </p>
    </DeskAuthPage>
  );
}

/** The password an invited account chooses, on the phone. */
export function CreerMotDePasseMobile() {
  return (
    <Screen
      className="pt-28"
      bottom={
        <BottomBar surface="plain" className="pt-6 pb-9">
          <Button block>Créer mon mot de passe</Button>
        </BottomBar>
      }
    >
      <LogoTile className="ml-36 size-16 rounded-[16px] text-26">AL</LogoTile>
      <h1 className="relative -top-px mt-5 text-center text-28 font-bold">Bienvenue, Karim</h1>
      <p className="mx-auto mt-1.5 w-[320px] text-center text-15 whitespace-break-spaces text-muted">
        Navette chez Atelier Lumen · karim.daoud@atelier-lumen.fr
      </p>
      <PhoneField label="Mot de passe" value={SAMPLE_PASSWORD} className="mt-7" />
      <PhoneField label="Confirmer" value={SAMPLE_PASSWORD} className="mt-4" />
      <ul className="mt-[19px] flex flex-col gap-[9px]">
        <Rule>12 caractères au moins</Rule>
        <Rule>Les deux mots de passe sont identiques</Rule>
      </ul>
    </Screen>
  );
}
