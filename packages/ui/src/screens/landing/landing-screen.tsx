import { LandingPage, type LandingCopy } from '#components/landing-page';

export const LANDING_FR: LandingCopy = {
  nav: {
    home: 'Courrier, accueil',
    journey: 'Le parcours',
    offline: 'Hors ligne',
    install: 'Installation',
    cta: 'Installer',
  },
  hero: {
    eyebrow: 'Service courrier',
    titleLead: 'Visez.',
    titleTail: 'C’est enregistré.',
    lineOne: 'Réception, notification, remise.',
    lineTwo: 'Tout tient dans l’iPhone.',
    install: 'Installer l’app',
    howItWorks: 'Comment ça marche',
    scanTitle: 'Scannez. Installez. C’est parti.',
    scanText: 'Avec l’appareil photo de l’iPhone.',
    scanLink: 'Comment ça marche ↓',
    scanLinkLabel: 'Comment ça marche : installer depuis courrier.ysl.fr',
    perks: ['Sans App Store', 'Même hors ligne', 'Un geste par colis'],
  },
  journey: {
    eyebrow: 'Le parcours',
    title: 'Un colis, trois moments.',
    text: 'De l’accueil au destinataire. Sans un papier.',
    received: {
      label: '01  Reçu',
      title: 'Visez. Suivant.',
      text: 'Tout un lot, en une rafale.',
    },
    notified: {
      label: '02  Notifié',
      title: 'Prévenu dans la seconde.',
      text: 'Son code de retrait avec.',
    },
    handedOver: {
      label: '03  Remis',
      title: 'Remis en main propre.',
      text: 'Un code, une signature. C’est tracé.',
    },
    batch: {
      title: 'Rafale en cours',
      progress: '3 sur 12',
      names: 'Camille Roux, Hugo Bernard, Léa Martin…',
    },
    notification: {
      device: 'iPhone de Camille',
      sender: 'Service courrier',
      time: 'maintenant',
      title: 'Un colis vous attend à l’accueil',
      body: 'Présentez ce code au retrait : 4821.',
      footnote: 'Envoyé depuis votre messagerie',
    },
    handover: {
      codeLabel: 'CODE DE RETRAIT',
      handedAt: 'Remis à 10 h 42',
      signature: 'Signature : Camille Roux',
    },
  },
  offline: {
    eyebrow: 'Hors ligne',
    title: 'Même au sous-sol.',
    text: 'Pas de réseau ? Rien ne se perd.',
    chipPending: '3 en attente',
    chipSynced: 'Synchronisé',
    queueTitle: 'Mode avion · 3 colis en attente',
    pending: 'En attente',
    queue: [
      { name: 'Nora Petit', meta: 'Studio · 8 h 55' },
      { name: 'Inès Garnier', meta: 'RH · 9 h 10' },
      { name: 'Paul Lefèvre', meta: 'Accessoires · 9 h 12' },
    ],
  },
  install: {
    eyebrow: 'Installation',
    title: 'Prête en trois gestes.',
    text: 'Pas d’App Store. Juste Safari.',
    scanTitle: 'Scannez avec l’iPhone',
    scanText: 'Visez-le avec l’appareil photo.',
    gestures: ['Partagez', 'Sur l’écran d’accueil', 'C’est prêt.'],
  },
  closing: {
    install: 'Installer l’app',
    alreadyInstalled: 'Déjà installée ? Ouvrez-la depuis l’écran d’accueil.',
    title: 'Prêt pour le prochain lot ?',
    text: 'Installez Courrier. Le prochain colis vous attend.',
    scanTitle: 'Scannez pour ouvrir',
    scanText: 'sur l’iPhone →',
  },
  footer: { service: 'Service courrier', usage: 'Usage interne · Version 1.0' },
};

/** The landing page as drawn in Penpot, with the copy of the mock-up. */
export function LandingScreen() {
  return (
    <LandingPage
      copy={LANDING_FR}
      appName="Courrier"
      url="https://courrier.ysl.fr"
      host="courrier.ysl.fr"
    />
  );
}
