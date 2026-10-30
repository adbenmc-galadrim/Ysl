# Spike S5 · e-mail via la messagerie du téléphone

Ticket YSL-8. D2 révisée : l'e-mail part de l'adresse de l'utilisateur, par la messagerie du
téléphone, prérempli par l'app ; pas de fournisseur d'envoi côté serveur (Scaleway TEM
abandonné, le §10.1 S5 du cahier des charges v2 est périmé sur ce point). L'utilisateur gère
et crée ses propres modèles. Prototype : [`apps/spike-email`](https://github.com/adbenmc-galadrim/Ysl/tree/6d15167a09ca8bc9052ab18a218e6b5d52af2a77/apps/spike-email) (retiré, YSL-138).

| Critère   | Seuil                                                                                        |
| --------- | -------------------------------------------------------------------------------------------- |
| Ouverture | le mail prérempli s'ouvre dans Mail iOS et dans Outlook avec destinataire, objet et corps    |
| Rendu     | accents, typographie française et sauts de ligne intacts à l'arrivée                         |
| Limites   | documentées : HTML, QR, pièces jointes, longueur maximale par messagerie                     |
| Modèles   | une piste pour que l'utilisateur crée et gère son modèle                                     |
| Sinon     | `mailto:` seul, en texte brut, code de retrait écrit en clair ; QR par la feuille de partage |

## Appareil

iPhone (D5 : iOS 26), PWA installée depuis `/spike-email/`, Mail
configuré avec le compte de l'utilisateur ; Outlook et Gmail installés et connectés si
possible.

## Ce que l'app mesure

- **Composer** : destinataires (À, Cc, Cci, plusieurs adresses séparées par des virgules),
  objet et corps, remplis à la main, par un **cas préparé** ou par un **modèle**. Trois liens
  ouvrent le brouillon : `mailto:` (Mail, ou l'app de messagerie par défaut), `ms-outlook://compose`
  et `googlegmail:///co`. La longueur de chaque URL est affichée.
- Chaque ouverture entre au journal : cible, source, nombre de destinataires, longueurs, et
  « app quittée » si la page est passée en arrière-plan dans les 2 s (sinon « resté ? » :
  app absente, confirmation refusée ou lien bloqué). Chaque chargement de la page est
  compté : « page rechargée ensuite » signale qu'iOS a rechargé la PWA au retour de la
  messagerie.
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

1. Sur l'iPhone, ouvrir `/spike-email/` dans Safari, puis Partager ›
   Sur l'écran d'accueil. Lancer **Spike S5** depuis l'icône. Journal : noter `standalone`,
   `share`, `canShareFiles`.
2. Composer : **À** = sa propre adresse ; **Adresse de réponse** = une seconde adresse à
   soi (elle reçoit les réponses « Ce n'est pas à moi »).
3. Modèle **Retrait (maquette)** › Appliquer. Ouvrir dans **Mail**, vérifier destinataire,
   objet et corps dans le brouillon, envoyer. Revenir dans le spike : noter si la page a
   été rechargée (le brouillon doit être intact), saisir le verdict dans « Dernier essai ».
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

Passage du 23/10/2026, de 16 h 22 à 17 h 03, PWA installée, journal exporté (18 essais,
2 chargements de page). Safari 27.0.1 d'après l'agent utilisateur, qui fige la version
d'iOS (`iPhone OS 18_7`). `standalone`, `share` et `canShareFiles` : `true`. Messageries :
Mail et Outlook sur un compte Gmail, app Gmail ; mails lus sur l'iPhone et dans Mail sur
le Mac. Les verdicts ont été donnés de vive voix pendant le test ; le journal n'en garde
qu'un.

| Mesure                           | Mail iOS                                               | Outlook                                    | Gmail      |
| -------------------------------- | ------------------------------------------------------ | ------------------------------------------ | ---------- |
| S'ouvre depuis la PWA            | oui, moins d'une seconde                               | oui si l'app est chargée (voir plus bas)   | oui        |
| Destinataire, objet, corps       | oui                                                    | oui                                        | oui        |
| Plusieurs destinataires, Cc, Cci | oui                                                    | oui                                        | non testé  |
| Accents, typographie, emoji      | oui                                                    | oui (même rendu)                           | oui        |
| Sauts de ligne, lignes vides     | oui ; indentation supprimée                            | même rendu                                 | même rendu |
| Caractères réservés              | oui, objet et corps intacts                            | non testé                                  | non testé  |
| Liens `mailto:` cliquables       | oui, mais affichés en clair                            | oui, mais affichés en clair                | même rendu |
| Corps HTML                       | balises affichées telles quelles                       | non testé                                  | non testé  |
| Longueur maximale du corps       | 100 000 car. reçus jusqu'à `FIN` (URL de 300 075 car.) | 100 000 car. reçus jusqu'à `FIN`           | non testé  |
| Partage : QR joint ou inséré     | inséré en pied du corps                                | en pièce jointe                            | non testé  |
| Partage : objet et texte repris  | texte oui, objet vide                                  | texte oui, objet = première ligne du texte | non testé  |
| Partage : destinataire à saisir  | oui                                                    | oui                                        | non testé  |
| Partage : QR reçu lisible        | oui (`4821`)                                           | oui                                        | non testé  |
| Pièce jointe par `mailto:`       | impossible (texte seulement)                           | impossible                                 | impossible |
| Retour dans la PWA : rechargée ? | non                                                    | non                                        | non        |
| Brouillon et essai conservés     | oui                                                    | oui                                        | oui        |

**Ouverture.** Les trois messageries s'ouvrent depuis la PWA installée et rendent le même
texte. Le rendu est identique de l'une à l'autre : un seul gabarit texte suffit.

**Apps déchargées.** Outlook avait été « déchargé » par iOS (app conservée sur l'écran
d'accueil, binaire retiré). Dans cet état, `ms-outlook://` échoue avec « Safari ne peut pas
ouvrir la page, car l'adresse n'est pas valide ». Après un lancement d'Outlook, le lien
marche. Le partage vers Outlook affiche de même « Setup needed · Please open the Outlook app
before continuing » tant que l'app n'a pas été ouverte. `mailto:` vers la messagerie par
défaut n'a pas ce défaut.

**Longueur.** Aucune limite atteinte : un corps de 100 000 caractères (URL de 300 075
caractères) s'ouvre en moins d'une seconde et arrive entier dans Mail et dans Outlook.

**Mise en forme.** Texte brut seulement : les balises HTML s'affichent telles quelles, les
espaces en début de ligne sont supprimés. Les lignes vides, les puces `•`, les accents, la
typographie française, les emoji et les caractères réservés (`& = ? # %`) arrivent intacts.

**Liens de réponse.** Les liens `mailto:` imbriqués sont cliquables dans Mail (iPhone et Mac)
et dans Outlook, et ouvrent un brouillon vers l'agent avec l'objet et le corps prévus. Mais
le texte brut les affiche en entier et encodés (trois lignes de `%20`, `%C3%A0`…) : ils sont
fonctionnels mais illisibles.

**Expéditeur.** Le mail part du compte de l'utilisateur, sous son nom (ici « Genesis », nom
du compte Gmail) : le salarié voit l'agent, pas « Service courrier ».

**QR.** Seule la feuille de partage met le QR dans le mail : inséré en pied de mail dans
Mail, en pièce jointe dans Outlook, lisible dans les deux. Le destinataire est toujours à
saisir et l'objet n'est pas maîtrisé (vide dans Mail, première ligne du texte dans
Outlook). Un essai Outlook n'a renvoyé aucun résultat de `navigator.share` au journal.

**Modèles.** Création, modification, duplication, suppression, rétablissement et aperçu
fonctionnent ; la variable inconnue reste visible et signalée. Après l'app tuée et relancée
(second chargement de page à 16 h 58), le modèle « Relance » a servi à l'essai suivant :
modèles, brouillon et journal survivent.

**Détection « app quittée ».** Juste pour Mail (11 essais sur 11) et pour Outlook (deux
échecs « adresse invalide » vus comme tels, l'essai réussi vu comme ouvert) ; elle a manqué
l'ouverture de Gmail, plus lente que la fenêtre de 2 s. À ne pas réutiliser comme preuve
d'ouverture dans l'app réelle.

## Verdict

**Go** pour D2 : l'e-mail prérempli par `mailto:`, envoyé depuis la messagerie de
l'utilisateur, est la voie principale du MVP.

| Critère   | Résultat                                                                                                          |
| --------- | ----------------------------------------------------------------------------------------------------------------- |
| Ouverture | ✅ Mail, Outlook et Gmail, destinataire, objet et corps ; Outlook seulement s'il est chargé                       |
| Rendu     | ✅ accents, typographie, puces et lignes vides ; ⚠️ indentation supprimée                                         |
| Limites   | ✅ documentées : texte brut, pas de HTML ni de pièce jointe, pas de limite de longueur jusqu'à 100 000 caractères |
| Modèles   | ✅ prototype local concluant                                                                                      |

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

- **YSL-66 (gabarit d'e-mail)** : gabarit en texte brut. Code de retrait écrit en clair,
  mis en avant en début de mail ; colis en puces `•`, aucune mise en forme par espaces. Pas
  de QR dans le mail prérempli : le code suffit au comptoir (D6 : QR ou code).
- **Liens de réponse** : ne pas imbriquer de `mailto:` brut. Choisir entre un lien court vers
  l'app (`https://…/r/<jeton>`, qui ouvre ensuite le brouillon de réponse) et une consigne
  « répondez à ce mail : pas à moi / un collègue passera ».
- **YSL-62** : `mailto:` vers la messagerie par défaut devient la voie principale, plus un
  simple repli. Outlook et Gmail restent en option, avec un message clair si l'app est
  déchargée ou jamais ouverte.
- **YSL-61** : un mail par destinataire, un geste « Envoyer » par mail ; pas de limite de
  longueur pour regrouper beaucoup de colis.
- **YSL-63** : suivi des envois déclaratif. L'app sait qu'elle a ouvert la messagerie, pas
  que le mail est parti ; l'agent confirme.
- **Modèles** : modèles par utilisateur côté serveur, copie locale hors ligne, liste fermée
  de variables avec signalement des inconnues, modèle par défaut rétablissable.
- **QR par la feuille de partage** : bonus possible, jamais la voie principale (destinataire
  à ressaisir, objet non maîtrisé).
- **Spike** : `apps/spike-email` retiré du dépôt et de l'image par YSL-138.
