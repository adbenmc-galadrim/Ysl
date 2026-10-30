const LEVELS = ['Désactivée', 'Facultative', 'Obligatoire'] as const;

export type WizardStep = {
  title: string;
  hint: string;
  options: readonly string[];
  value: string;
  modified?: boolean;
};

export type WizardStepGroup = { title: string; steps: WizardStep[] };

/** The steps of the "Multi-départements" model, signature made mandatory. */
export const STEP_GROUPS: WizardStepGroup[] = [
  {
    title: 'Réception',
    steps: [
      {
        title: 'Revue du lot',
        hint: 'Revoir les cas douteux avant d’enregistrer le lot',
        options: LEVELS,
        value: 'Facultative',
      },
    ],
  },
  {
    title: 'Dépôt',
    steps: [
      {
        title: 'Navette = département',
        hint: 'Elle remet elle-même les colis aux salariés',
        options: ['Non', 'Oui'],
        value: 'Non',
      },
      {
        title: 'Confirmation du dépôt',
        hint: 'Le département confirme ce qu’il reçoit',
        options: ['Désactivée', 'Au nombre', 'Colis par colis'],
        value: 'Au nombre',
      },
    ],
  },
  {
    title: 'Remise',
    steps: [
      {
        title: 'Preuve par QR ou code',
        hint: 'Le salarié présente le QR ou le code de son e-mail',
        options: LEVELS,
        value: 'Obligatoire',
      },
      {
        title: 'Scan du colis',
        hint: 'Chaque colis remis est scanné',
        options: LEVELS,
        value: 'Facultative',
      },
      {
        title: 'Signature',
        hint: 'Le salarié signe sur l’écran',
        options: LEVELS,
        value: 'Obligatoire',
        modified: true,
      },
      {
        title: 'Photo',
        hint: 'Photo du colis remis',
        options: LEVELS,
        value: 'Désactivée',
      },
      {
        title: 'Retrait par un collègue',
        hint: 'Un collègue peut retirer à la place du salarié',
        options: LEVELS,
        value: 'Facultative',
      },
    ],
  },
  {
    title: 'E-mails',
    steps: [
      {
        title: 'Moment de l’e-mail',
        hint: 'Quand le salarié est prévenu',
        options: ['Au scan', 'Au dépôt'],
        value: 'Au dépôt',
      },
      {
        title: 'Relances',
        hint: 'Rappels au salarié qui ne vient pas',
        options: ['Aucune', 'J+2', 'J+2 et J+5'],
        value: 'J+2 et J+5',
      },
    ],
  },
];
