import type { ReactNode } from 'react';

import { BottomBar } from '#components/bottom-bar';
import { Button } from '#components/button';
import { CompanyLogo, DeskAuthPage } from '#components/company-parts';
import { DeskField } from '#components/desk-form';
import { PhoneField } from '#components/phone-parts';
import { Screen } from '#components/screen';
import { SAMPLE_PASSWORD } from '#fixtures/multi-entreprises';
import { Icon } from '#icons';

/** Sign-in on the computer, before any company is known. `form` is the app's, the mockup's sample otherwise. */
export function ConnexionDesktop({ form }: { form?: ReactNode }) {
  return (
    <DeskAuthPage
      logo="C"
      logoClass="bg-fill-2 text-ink"
      brand="Courrier"
      footer="Courrier · gestion du courrier d’entreprise"
      fluid={form !== undefined}
    >
      <h1 className="text-26 font-bold tracking-[-0.3px]">Se connecter</h1>
      <p className="mt-1.5 text-14 text-muted">
        Avec l’e-mail de votre entreprise
      </p>
      {form ?? (
        <>
          <DeskField
            label="E-mail professionnel"
            type="email"
            value="julie.perrin@atelier-lumen.fr"
            className="mt-[34px]"
          />
          <DeskField
            label="Mot de passe"
            value={SAMPLE_PASSWORD}
            focused
            className="mt-4"
            type="password"
          />
          <p className="relative -top-px mt-5 text-13 font-medium">
            Mot de passe oublié ?
          </p>
          <Button className="mt-6 h-10 w-full rounded-[6px] text-14">
            <span className="relative -top-0.5">Se connecter</span>
          </Button>
        </>
      )}
      <div className="mt-8 h-px bg-separator" />
      <p className="mt-[15px] text-13 leading-[1.2] text-muted">
        Vous avez reçu une invitation ? Ouvrez le lien de l’e-mail pour créer
        votre mot de passe.
      </p>
    </DeskAuthPage>
  );
}

/** Sign-in on the phone, the same for every role. `form` and `submit` are the app's, the mockup's sample otherwise. */
export function ConnexionMobile({
  form,
  submit,
}: {
  form?: ReactNode;
  submit?: ReactNode;
}) {
  return (
    <Screen
      className="pt-[120px]"
      bottom={
        <BottomBar surface="plain" className="flex-col gap-0 pt-0 pb-9">
          <p className="relative -top-px text-center text-13 text-muted">
            Pas de compte ? Votre administrateur vous invite.
          </p>
          {submit ?? (
            <Button block className="mt-12">
              Se connecter
            </Button>
          )}
        </BottomBar>
      }
    >
      <CompanyLogo
        initials={<Icon name="package" size={30} />}
        className="ml-36 size-16 rounded-[16px]"
      />
      <h1 className="relative -top-px mt-5 text-center text-28 font-bold">Courrier</h1>
      <p className="mx-auto mt-1.5 w-[300px] text-center text-15 text-muted">
        Connectez-vous avec le compte reçu par e-mail.
      </p>
      {form ?? (
        <>
          <PhoneField
            label="E-mail"
            type="email"
            value="karim.daoud@atelier-lumen.fr"
            className="mt-5"
            boxClassName="bg-fill"
          />
          <PhoneField
            label="Mot de passe"
            value={SAMPLE_PASSWORD}
            className="mt-4"
            type="password"
            boxClassName="bg-fill"
          />
          <p className="mt-6 text-center text-15 font-semibold">
            Mot de passe oublié ?
          </p>
        </>
      )}
    </Screen>
  );
}

/** A message on the phone about an invitation link; by default, its seven days are over. */
export function LienExpireMobile({
  title = 'Ce lien a expiré',
  text = 'Les invitations sont valables 7 jours. Demandez à votre administrateur de vous en renvoyer une.',
  action,
  done = false,
}: {
  title?: string;
  text?: string;
  /** The link has done its work: a tick rather than the clock. */
  done?: boolean;
  /** Left out, the mockup's button. */
  action?: ReactNode;
} = {}) {
  return (
    <Screen className="items-center pt-[220px] pr-[21px]">
      <span
        className={
          done
            ? 'flex size-[88px] items-center justify-center rounded-full bg-green-soft text-green'
            : 'flex size-[88px] items-center justify-center rounded-full bg-orange-soft text-orange'
        }
      >
        <Icon name={done ? 'tick' : 'clock'} size={40} />
      </span>
      <h1 className="mt-5 text-center text-22 font-bold">{title}</h1>
      <p className="mt-[9px] w-[320px] text-center text-15 leading-[1.35] whitespace-break-spaces text-muted">
        {text}
      </p>
      {action ?? (
        <Button
          variant="secondary"
          size="md"
          icon="mail"
          iconSize={20}
          className="mt-[25px] h-12 w-[250px] rounded-[24px]"
        >
          Écrire à Claire Bonnet
        </Button>
      )}
    </Screen>
  );
}

/** First sign-in with a temporary password, typed too short. */
export function PremiereConnexionMobile() {
  return (
    <Screen
      className="pt-28"
      bottom={
        <BottomBar surface="plain" className="pt-6 pb-9">
          <Button block>Enregistrer et continuer</Button>
        </BottomBar>
      }
    >
      <CompanyLogo initials="AL" className="size-12 rounded-[12px] text-[19px]" />
      <h1 className="relative -top-px mt-4 text-28 font-bold">Choisissez votre mot de passe</h1>
      <p className="mt-2 text-15 leading-[1.4] text-muted">
        Vous vous êtes connecté avec un mot de passe provisoire. Remplacez-le
        avant de continuer.
      </p>
      <PhoneField
        label="Nouveau mot de passe"
        value="motdep"
        error
        className="mt-[26px]"
        type="password"
        boxClassName="bg-fill"
      />
      <p className="relative -top-px mt-1.5 text-13 text-red">
        Encore 6 caractères : 12 au moins.
      </p>
      <PhoneField
        label="Confirmer"
        placeholder="Retapez-le"
        className="mt-[18px]"
        type="password"
        boxClassName="bg-fill"
      />
    </Screen>
  );
}
