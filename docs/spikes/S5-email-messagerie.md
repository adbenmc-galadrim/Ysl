# Spike S5 · e-mail via la messagerie du téléphone

Ticket YSL-8. D2 révisée : l'e-mail part de l'adresse de l'utilisateur, par la messagerie du
téléphone, prérempli par l'app ; pas de fournisseur d'envoi côté serveur (Scaleway TEM
abandonné, le §10.1 S5 du cahier des charges v2 est périmé sur ce point). L'utilisateur gère
et crée ses propres modèles. Prototype : [`apps/spike-email`](../../apps/spike-email).

| Critère   | Seuil                                                                                        |
| --------- | -------------------------------------------------------------------------------------------- |
| Ouverture | le mail prérempli s'ouvre dans Mail iOS et dans Outlook avec destinataire, objet et corps    |
| Rendu     | accents, typographie française et sauts de ligne intacts à l'arrivée                         |
| Limites   | documentées : HTML, QR, pièces jointes, longueur maximale par messagerie                     |
| Modèles   | une piste pour que l'utilisateur crée et gère son modèle                                     |
| Sinon     | `mailto:` seul, en texte brut, code de retrait écrit en clair ; QR par la feuille de partage |

## Appareil

iPhone (D5 : iOS 26), PWA installée depuis https://ysl.shinseo.fr/spike-email/, Mail
configuré avec le compte de l'utilisateur ; Outlook et Gmail installés et connectés si
possible.

## Ce que l'app mesure

- **Composer** : destinataires (À, Cc, Cci, plusieurs adresses séparées par des virgules),
  objet et corps, remplis à la main, par un **cas préparé** ou par un **modèle**. Trois liens
  ouvrent le brouillon : `mailto:` (Mail, ou l'app de messagerie par défaut), `ms-outlook://compose`
  et `googlegmail:///co`. La longueur de chaque URL est affichée.
- Chaque ouverture entre au journal : cible, source, nombre de destinataires, longueurs, et
  « app quittée » si la page est passée en arrière-plan dans les 2 s (sinon « resté ? » :
  app absente, confirmation refusée ou lien bloqué).
- **Partager avec le QR** : feuille de partage iOS avec le QR du code 4821 en PNG joint,
  l'objet en titre et le corps en texte.
- **Cas préparés** : accents et typographie, sauts de ligne, caractères réservés
  (`& = ? # %`), URL longue, plusieurs destinataires avec Cc et Cci, liens de réponse dans
  le corps, corps HTML, corps de 2 000, 8 000, 32 000 et 100 000 caractères. Les corps longs
  sont numérotés ligne par ligne et finissent par `FIN` : la dernière ligne reçue dit où la
  messagerie a coupé.
- **Modèles** : créer, dupliquer, modifier, supprimer ; rétablir le modèle par défaut (celui
  de la maquette « E-mail reçu par le salarié »). Stockés sur le téléphone (`localStorage`).
- **Journal** : verdict OK / Partiel / KO et note par essai, conservés au retour de la
  messagerie, export JSON.

## Protocole

1. Sur l'iPhone, ouvrir https://ysl.shinseo.fr/spike-email/ dans Safari, puis Partager ›
   Sur l'écran d'accueil. Lancer **Spike S5** depuis l'icône. Journal : noter `standalone`,
   `share`, `canShareFiles`.
2. Composer : **À** = sa propre adresse ; **Adresse de réponse** = une seconde adresse à
   soi (elle reçoit les réponses « Ce n'est pas à moi »).
3. Modèle **Retrait (maquette)** › Appliquer. Ouvrir dans **Mail**, vérifier destinataire,
   objet et corps dans le brouillon, envoyer. Revenir dans le spike, saisir le verdict.
   Recommencer avec **Outlook** puis **Gmail**.
4. Ouvrir les mails reçus, dans Mail et dans Outlook : accents, puces, sauts de ligne ; les
   deux liens `mailto:` sont-ils cliquables ? Toucher « Ce n'est pas à moi » : un nouveau
   brouillon vers l'adresse de réponse doit s'ouvrir, objet et corps remplis.
5. Pour chaque cas préparé, dans Mail puis dans Outlook (Gmail si le temps le permet) :
   Charger le cas, ouvrir, vérifier le brouillon, envoyer, saisir le verdict avec une note
   (pour les corps longs : la dernière ligne présente dans le brouillon, et dans le mail
   reçu).
6. **Plusieurs destinataires** : ajouter une seconde adresse dans À ; vérifier À, Cc et Cci
   dans chaque messagerie.
7. **Corps HTML** : noter si les balises arrivent en texte brut.
8. **Partager avec le QR** : choisir Mail, puis Outlook, dans la feuille de partage. Noter
   si le QR est joint ou inséré, si l'objet et le texte suivent, s'il faut saisir le
   destinataire. Envoyer, puis scanner le QR reçu avec un autre téléphone (il doit lire
   `4821`).
9. **Modèles** : créer un modèle, le modifier, l'appliquer dans Composer, ouvrir dans Mail.
   Tuer l'app, la relancer : le modèle et le journal sont toujours là.
10. Journal › Exporter le journal (AirDrop vers le Mac).

## Résultats

À remplir après le passage sur l'iPhone.

| Mesure                           | Mail iOS | Outlook | Gmail |
| -------------------------------- | -------- | ------- | ----- |
| S'ouvre depuis la PWA            |          |         |       |
| Destinataire, objet, corps       |          |         |       |
| Plusieurs destinataires, Cc, Cci |          |         |       |
| Accents, typographie, emoji      |          |         |       |
| Sauts de ligne, lignes vides     |          |         |       |
| Caractères réservés              |          |         |       |
| Liens `mailto:` cliquables       |          |         |       |
| Corps HTML                       |          |         |       |
| Longueur maximale du corps       |          |         |       |
| QR par la feuille de partage     |          |         |       |

## Limites connues avant le test

- **Texte brut seulement.** `mailto:` (RFC 6068) ne porte que du texte : pas de HTML, pas de
  mise en forme, pas d'image en ligne, pas de pièce jointe. Les schémas d'Outlook et de Gmail
  n'en portent pas davantage. Le mail ne ressemblera pas à la maquette : pas de bloc QR, pas
  de boutons ; le code de retrait s'écrit en clair et les réponses passent par des liens
  `mailto:`.
- **QR.** Seule la feuille de partage (`navigator.share` avec un fichier) met une image dans
  le mail ; elle ne préremplit pas le destinataire, et l'objet n'est pas garanti.
- **Un mail à la fois.** Chaque mail demande un geste dans la messagerie (Envoyer) puis un
  retour dans l'app : le regroupement par personne (D12) reste un mail par destinataire.
- **Aucune trace d'envoi.** L'app sait qu'elle a ouvert la messagerie, pas que le mail est
  parti : le statut « envoyé » est déclaratif.
- **Encodage.** Les espaces doivent être encodés `%20` : un `+` (encodage de formulaire)
  s'affiche tel quel dans Mail.

## Piste : modèles gérés par l'utilisateur

- **Où.** Dans l'app réelle, les modèles appartiennent à l'utilisateur et vivent sur le
  serveur (table par utilisateur), avec une copie locale pour le hors-ligne (D3) : changer
  de téléphone ne les perd pas. Le spike les garde dans `localStorage` pour mesurer l'usage,
  pas la persistance.
- **Variables.** Une liste fermée, affichée sous l'éditeur : `{prénom}`, `{nom}`, `{code}`,
  `{colis}` (liste à puces), `{lieu}`, `{horaires}`, `{agent}`, `{lien_pas_moi}`,
  `{lien_collegue}`. Une variable inconnue reste visible telle quelle et l'éditeur la
  signale : un mail ne part jamais avec un trou silencieux. Une valeur n'est jamais
  réinterprétée (pas de substitution en cascade).
- **Garde-fous.** Un modèle par défaut non supprimable et rétablissable ; l'aperçu rendu
  avant ouverture ; un avertissement si le corps rendu dépasse la longueur maximale mesurée.
- **Plusieurs modèles.** Premier envoi, relance J+2, relance J+5, colis en souffrance (D12 :
  le rythme est géré par l'utilisateur).

## Conséquences

À écrire avec le verdict : gabarit texte de YSL-66 (code en clair, QR ou non), YSL-61 (un
mail par destinataire, geste par mail), YSL-62 (le repli `mailto:` devient la voie
principale), YSL-63 (suivi des envois déclaratif).
