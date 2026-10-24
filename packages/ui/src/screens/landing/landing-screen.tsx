import { LandingPage } from '#components/landing-page';
import { LANDING_FR } from '#components/landing-page/landing-fr';

/** The landing page as drawn in Penpot, with the copy of the mock-up. */
export function LandingScreen() {
  return (
    <LandingPage
      copy={LANDING_FR}
      appName="Courrier"
      url="https://courrier.ysl.fr"
      host="courrier.ysl.fr"
      version="1.0"
      signInHref="/connexion"
    />
  );
}
