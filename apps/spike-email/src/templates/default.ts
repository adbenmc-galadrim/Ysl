import type { TemplateFields } from '#/templates/render';

export type Template = {
  id: string;
  name: string;
  subject: string;
  body: string;
};

export const DEFAULT_TEMPLATE_ID = 'default';

export const DEFAULT_TEMPLATE: Template = {
  id: DEFAULT_TEMPLATE_ID,
  name: 'Retrait (maquette)',
  subject: 'Des colis vous attendent au service courrier · code {code}',
  body: [
    'Bonjour {prénom},',
    '',
    'Des colis sont arrivés pour vous. Donnez ce code au comptoir : {code}',
    '',
    '{colis}',
    '',
    'Où : {lieu}',
    'Quand : {horaires}',
    '',
    'Ce n’est pas à moi :',
    '{lien_pas_moi}',
    '',
    'Un collègue passera :',
    '{lien_collegue}',
    '',
    '{agent}',
  ].join('\n'),
};

export const DEFAULT_FIELDS: TemplateFields = {
  prénom: 'Nora',
  nom: 'Haddad',
  code: '4821',
  colis: 'Amazon ···4471, reçu à 10 h 15\nAmazon ···4472, reçu à 10 h 15',
  lieu: 'Rez-de-chaussée, comptoir courrier',
  horaires: 'Lun. au ven., 9 h à 12 h 30 et 14 h à 18 h',
  agent: 'Service courrier',
};
