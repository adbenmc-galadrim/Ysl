import { BottomBar } from '#components/bottom-bar';
import { Button } from '#components/button';
import { Field, FieldInput } from '#components/field';
import { HeroTile } from '#components/hero-tile';
import { PageIntro } from '#components/page-intro';
import { Screen } from '#components/screen';
import { Icon } from '#icons';

export type SignInScreenProps = {
  email?: string;
  password?: string;
  onSubmit?: () => void;
  onForgot?: () => void;
};

/**
 * Sign-in with the agent's own account, one per person. The app mark sits where a
 * logo would, and the button stays in the thumb zone like every other
 * screen's main action.
 */
export function SignInScreen({
  email = '',
  password = '',
  onSubmit,
  onForgot,
}: SignInScreenProps) {
  return (
    <Screen
      bottom={
        <BottomBar>
          <Button block onClick={onSubmit}>
            Se connecter
          </Button>
        </BottomBar>
      }
    >
      <HeroTile icon="package" tone="ink" size="md" className="mt-[62px]" />
      <PageIntro
        title="Service courrier"
        description="Connectez-vous avec votre compte du service."
        className="mt-5"
      />
      <Field label="Adresse e-mail" className="mt-[47px]">
        {(id) => (
          <FieldInput
            id={id}
            type="email"
            autoComplete="username"
            defaultValue={email}
          />
        )}
      </Field>
      <Field label="Mot de passe" className="mt-[22px]">
        {(id) => (
          <FieldInput
            id={id}
            type="password"
            autoComplete="current-password"
            defaultValue={password}
            trailing={
              <Icon name="lock" size={20} className="shrink-0 text-muted" />
            }
          />
        )}
      </Field>
      <Button
        variant="link"
        className="mt-[18px] self-end text-15 font-medium"
        onClick={onForgot}
      >
        Mot de passe oublié
      </Button>
    </Screen>
  );
}
