# Script de recette par rôle

À jouer par la personne qui accepte le MVP, sur `https://ysl.shinseo.fr`, avec de vraies étiquettes.
Il remplace les parcours P1 à P6 de l'agent unique (révision du 29/10/2026).

Ce document n'est pas un compte rendu : **aucune case n'est cochée, la recette reste à faire.** Il a
seulement été déroulé sur une base de démo locale, pour vérifier que chaque geste et chaque libellé
existent (voir [Ce que le rejeu a vérifié](#ce-que-le-rejeu-a-vérifié)).

Pour chaque étape : cocher OK ou KO. En cas de KO, noter ce que la dernière colonne demande, et
toujours l'heure et une capture.

## Avant de commencer

### Règles

- **Aucun salarié réel ne reçoit de message.** L'annuaire de recette ne contient que vos propres
  adresses. Un nom lu sur une étiquette réelle qui n'y figure pas : affecter le colis à un salarié de
  test. Relire l'adresse affichée avant chaque envoi.
- **Ne pas se déconnecter d'un iPhone qui a reçu des colis** : la déconnexion efface sa base locale,
  seule copie des photos et des preuves (D8). Un iPhone = un compte. Prendre un appareil libre pour
  la navette de recette, ou jouer ses étapes sur un compte déjà connecté à une entreprise de test.
- **La clé Brevo reste non posée** pendant les parties 1 à 8. La poser fait partir de vrais e-mails
  pour toutes les entreprises : c'est une décision à part, partie 9.

### Matériel

| Quoi | Pour quoi |
|---|---|
| Un ordinateur, deux profils de navigateur | admin de l'app ; admin entreprise |
| Un iPhone libre, app installée | navette |
| Un second iPhone, ou un troisième profil de navigateur | département |
| Un lot de 5 étiquettes réelles au moins | la tournée ; les nombres ci-dessous valent pour 5 colis, à adapter |
| Une imprimante | l'affiche QR du point de réception |
| Une boîte mail à alias (`vous+lea@…`) | adresses de tous les comptes et salariés de test |

### Comptes à préparer

Les deux comptes de prod (admin entreprise et admin de l'app) ont un mot de passe que personne ne
connaît. Leurs adresses sont dans `kibo-notes/recette-rappels.md`, hors du dépôt, qui est public.

| N° | Compte et rôle | Geste | Résultat attendu | OK / KO | Noter si écart |
|---|---|---|---|---|---|
| 0.1 | Terminal du conteneur de l'API | Poser le mot de passe de l'admin de l'app : `auth:reset-password`, procédure de `docs/comptes.md`, sans `--close-sessions` | Le script confirme le compte | ☐ OK ☐ KO | Sortie du script, sans le mot de passe |
| 0.2 | Terminal du conteneur de l'API | Même geste pour l'admin entreprise | Le script confirme le compte | ☐ OK ☐ KO | Sortie du script, sans le mot de passe |
| 0.3 | Sans compte | Ouvrir `https://ysl-api.shinseo.fr/ready` | 200 | ☐ OK ☐ KO | Code de réponse |
| 0.4 | Admin entreprise, ordinateur | Se connecter, ouvrir Réglages, lire le bas de page | Version du jour, « À jour » | ☐ OK ☐ KO | Version affichée, version attendue |

Fichier d'annuaire à préparer (`annuaire-recette.csv`), avec vos alias :

```csv
prénom;nom;email;département;lieu
Léa;Fontaine;vous+lea@exemple.fr;Studio;Bât. A
Inès;Garnier;vous+ines@exemple.fr;Studio;Bât. A
Marc;Roux;vous+marc@exemple.fr;Finance;Bât. B
Paul;Mercier;vous+paul@exemple.fr;Finance;Bât. B
```

## 1. Création d'une entreprise et invitations

Sans clé Brevo, aucune invitation ne part : l'écran donne un lien à copier, une seule fois. Le
transmettre soi-même, puis l'ouvrir dans le navigateur ou l'iPhone du compte.

| N° | Compte et rôle | Geste | Résultat attendu | OK / KO | Noter si écart |
|---|---|---|---|---|---|
| A1 | Admin de l'app, ordinateur | Se connecter | Page Entreprises, bouton « Nouvelle entreprise », mention « Chiffres seulement : ni colis, ni annuaire, ni nom de salarié. » | ☐ OK ☐ KO | Ce qui s'affiche de nominatif |
| A2 | Admin de l'app | « Nouvelle entreprise », nom « Recette JJ/MM », modèle « Multi-départements », « Continuer » | « Étape 2 sur 3 », « aucune étape modifiée » | ☐ OK ☐ KO | Étape dont la valeur diffère de la carte du modèle |
| A3 | Admin de l'app | « Créer » | Fiche de l'entreprise, fenêtre « Étape 3 sur 3 · Inviter un administrateur » | ☐ OK ☐ KO | Message d'erreur |
| A4 | Admin de l'app | Nom et alias de l'admin de test, « Envoyer l'invitation » | « Lien à transmettre », « Aucun e-mail n'est parti : l'envoi n'est pas activé sur ce serveur. », « Copier le lien », valable 7 jours | ☐ OK ☐ KO | Si un e-mail est parti : **arrêter**, la clé est posée |
| A5 | Personne invitée, second profil | Ouvrir le lien, choisir un mot de passe de 12 caractères, « Créer mon mot de passe » | « Créer votre mot de passe » au nom de l'entreprise, puis « Votre mot de passe est enregistré » (D27) | ☐ OK ☐ KO | Écran affiché ; lien non ouvert : `CORS_ORIGIN` de la prod |
| A6 | Personne invitée | Rouvrir le même lien | « Ce lien a déjà servi » | ☐ OK ☐ KO | Si le formulaire revient : faille à remonter |
| A7 | Admin entreprise de test, ordinateur | Se connecter | Vue d'ensemble à zéro ; menu Vue d'ensemble, Colis, À régulariser, Annuaire, Comptes, Rapports, Réglages | ☐ OK ☐ KO | Entrée manquante ou en trop |
| A8 | Admin entreprise de test | Annuaire › « Importer un CSV », fichier ci-dessus, « Créer « Studio » », « Créer « Finance » », « Importer 4 salariés » | « 4 salariés dans 3 départements » (avec « Service courrier », présent d'office) | ☐ OK ☐ KO | Ligne en erreur, séparateur, accents |
| A9 | Admin entreprise de test | Réglages › Lieu et horaires de retrait : lieu et horaires, « OK » | Valeurs relues après rechargement | ☐ OK ☐ KO | Champ perdu |
| A10 | Admin entreprise de test | Comptes › « Inviter un compte » : Navette ; puis Département Studio ; puis Département Finance | Trois fois « Lien à transmettre à … » ; « 4 comptes · 1 invitation en attente » au dernier | ☐ OK ☐ KO | Rôle ou département faux dans la liste |
| A11 | Les trois comptes | Ouvrir chaque lien sur son appareil, choisir un mot de passe. Sur iPhone : Safari, puis connexion **dans l'app installée** | « Votre mot de passe est enregistré » ; tous « Actif » dans Comptes | ☐ OK ☐ KO | Trousseau : mot de passe repris ou non dans l'app |
| A12 | Admin entreprise de test | Réglages › Affiche QR du département : Studio et Finance, « Imprimer » ; poser les affiches | Une affiche par département, à son nom | ☐ OK ☐ KO | Page blanche, QR coupé |

## 2. Tournée et dépôt de la navette

| N° | Compte et rôle | Geste | Résultat attendu | OK / KO | Noter si écart |
|---|---|---|---|---|---|
| B1 | Navette, iPhone | Premier lancement : attendre la préparation, « Continuer » | Accueil « Tournée », « Rien à déposer » | ☐ OK ☐ KO | Durée de la préparation, message d'erreur |
| B2 | Navette | « Scanner », autoriser la caméra, photographier une étiquette | « Lot : 1 colis », bip | ☐ OK ☐ KO | Transporteur, numéro lu, numéro réel. Illisible : « Saisir le numéro » |
| B3 | Navette | Fermer l'app, la rouvrir | « Reprendre le lot ? », « Rien n'est perdu ». « Reprendre le scan » | ☐ OK ☐ KO | Colis perdu |
| B4 | Navette | Scanner les 4 autres, « Terminer » | « Vérifier le lot », « 5 colis lus » | ☐ OK ☐ KO | Valeurs lues fausses, par étiquette |
| B5 | Navette | Sur chaque colis : « Chercher dans l'annuaire », choisir Léa, Léa, Inès, Marc, Paul ; « Valider et suivant » | Département affiché à côté du nom ; « Tout est sûr » | ☐ OK ☐ KO | Nom réel proposé à tort |
| B6 | Navette | « Enregistrer 5 colis » | « 5 colis enregistrés », « 5 en route », « À déposer dans leur département » | ☐ OK ☐ KO | Colis en « À compléter » : lequel, pourquoi |
| B7 | Navette | Accueil | « 0 départements sur 2 déposés · 5 colis restent », Finance 2 colis, Studio 3 colis | ☐ OK ☐ KO | Répartition lue |
| B8 | Navette | Finance › « Déposer à Finance », viser l'affiche | « QR de Finance lu », « J'ai posé 2 colis » | ☐ OK ☐ KO | Temps de lecture, éclairage |
| B9 | Navette | « J'ai posé 2 colis » | « À Finance de confirmer », « En attente » | ☐ OK ☐ KO | Écran affiché |
| B10 | Navette | « Continuer la tournée », Studio › « Déposer à Studio » › « Choisir dans la liste » › Studio › « J'ai posé 3 colis » | « Quel département ? » puis « À Studio de confirmer ». Accueil : « à confirmer » sur les deux | ☐ OK ☐ KO | Écran affiché |

## 3. Confirmation et écart au département

D24 : le département confirme au nombre. D25 : un écart met le colis « À régulariser », visible de la
navette et de l'admin entreprise.

| N° | Compte et rôle | Geste | Résultat attendu | OK / KO | Noter si écart |
|---|---|---|---|---|---|
| C1 | Département Finance | Se connecter | « Nina Navette a posé 2 colis » (le nom de la navette), « Confirmer le dépôt », « À venir 2 » | ☐ OK ☐ KO | Délai d'apparition |
| C2 | Département Finance | « Confirmer le dépôt », « Confirmer 2 colis » | « 2 colis présents », « E-mails aux salariés », « 2 à envoyer ». Avec le modèle Multi-départements, l'e-mail part au dépôt, pas au scan | ☐ OK ☐ KO | Nombre lu |
| C3 | Département Studio | « Confirmer le dépôt », « Le compte n'y est pas », « Moins », désigner Inès comme manquant | « Il manque 1 colis », « Confirmer 2 et signaler » | ☐ OK ☐ KO | Choix absents |
| C4 | Département Studio | « Confirmer 2 et signaler » | « 2 colis présents », « Écart au dépôt », « Studio a compté 2 colis sur 3 » ; « À régulariser » sur Inès | ☐ OK ☐ KO | Colis mal classés |
| C5 | Navette | Accueil, en ligne | « 1 colis à régulariser », « Tout est déposé » | ☐ OK ☐ KO | Délai d'apparition |

## 4. E-mail au salarié, sans Brevo

Sans clé, l'e-mail part de la messagerie de l'appareil (`mailto:`). Il porte le code à 4 chiffres, et
le QR par « Partager avec le QR » sur iPhone. **Chaque aperçu tire un nouveau code : le bon est celui
du message envoyé.**

| N° | Compte et rôle | Geste | Résultat attendu | OK / KO | Noter si écart |
|---|---|---|---|---|---|
| D1 | Département Finance | Colis › « À notifier » : aperçu | Objet, « Votre code de retrait », transporteur, lieu saisi en A9, adresse de test | ☐ OK ☐ KO | Texte faux, ligne manquante. **Adresse réelle : ne pas envoyer** |
| D2 | Département Finance | « Envoyer à Marc », envoyer depuis la messagerie, revenir | Brouillon complet, Marc reçoit le message ; à l'écran, colis suivant | ☐ OK ☐ KO | Sans messagerie : « La messagerie ne s'est pas ouverte » doit proposer « Copier le texte », « Copier l'adresse », « Marquer comme envoyé quand même » |
| D3 | Département Finance | Même geste pour Paul, puis Réglages › E-mails envoyés | Marc et Paul listés | ☐ OK ☐ KO | Ligne absente |
| D4 | Département Studio, iPhone | « Notifier » : « Partager avec le QR » vers Mail, pour Léa | Un seul message pour ses 2 colis, QR inséré | ☐ OK ☐ KO | Objet vide (connu), QR illisible |

## 5. Remise au département

| N° | Compte et rôle | Geste | Résultat attendu | OK / KO | Noter si écart |
|---|---|---|---|---|---|
| E1 | Département Finance | « Remettre » › « Taper le code » : le code de Léa | « Ce code est pour Studio », « Rien n'a été remis » | ☐ OK ☐ KO | Si le colis s'ouvre : faille à remonter |
| E2 | Département Finance | Taper le code reçu par Marc | « Code vérifié », « Marc Roux », « Remettre 1 colis » | ☐ OK ☐ KO | Code du message, réponse |
| E3 | Département Finance | « Remettre 1 colis » | « 1 colis remis », « Code vérifié », « Remise enregistrée », « Annuler » possible | ☐ OK ☐ KO | État de l'envoi au serveur |
| E4 | Département Studio, iPhone | « Remettre », viser le QR reçu par Léa sur un autre écran | Léa Fontaine, 2 colis ; « Remettre 2 colis », puis « 2 colis remis » | ☐ OK ☐ KO | QR refusé : message exact |

## 6. Vue d'ensemble de l'admin entreprise

| N° | Compte et rôle | Geste | Résultat attendu | OK / KO | Noter si écart |
|---|---|---|---|---|---|
| F1 | Admin entreprise de test | Vue d'ensemble | En route 0, En attente de retrait 1, En souffrance 0, À régulariser 1, Remis aujourd'hui 3 ; Inès « Manquant au dépôt » | ☐ OK ☐ KO | Chiffre lu, chiffre attendu |
| F2 | Admin entreprise de test | Toucher la ligne Finance de « Par département » | Colis filtrés sur Finance, Paul présent | ☐ OK ☐ KO | Colis d'un autre département |
| F3 | Admin entreprise de test | À régulariser › Inès : lire « Que faire ? », choisir « Retrouvé, le redéposer à Studio », « Valider » | « 1 colis bloqué », « 2 comptés sur 3 » ; le colis quitte la liste et revient dans la tournée | ☐ OK ☐ KO | Choix manquant |
| F4 | Navette | Accueil | Studio de nouveau à déposer, 1 colis | ☐ OK ☐ KO | Délai d'apparition |

## 7. Rapports

| N° | Compte et rôle | Geste | Résultat attendu | OK / KO | Noter si écart |
|---|---|---|---|---|---|
| G1 | Admin entreprise de test, ordinateur | Rapports | Mois en cours : Colis reçus 5, Remis 3, Écarts au dépôt 1 ; tableau par département, transporteurs | ☐ OK ☐ KO | Chiffre lu, chiffre attendu |
| G2 | Admin entreprise de test | Département : Studio | Colis reçus 3, Remis 2 | ☐ OK ☐ KO | Chiffre lu |
| G3 | Admin entreprise de test | Département : Studio, « Exporter en CSV » ; ouvrir dans Excel | Téléchargement (feuille de partage sous Safari) ; 3 lignes de colis, accents et colonnes justes | ☐ OK ☐ KO | Nombre de lignes, colonne fausse |
| G4 | Admin entreprise de test | « Rapport PDF », enregistrer en PDF | Page sans ses commandes, A4 paysage, chiffres identiques | ☐ OK ☐ KO | PDF blanc ou coupé |
| G5 | Département et navette | Ouvrir `/rapports` | Renvoi à leur accueil | ☐ OK ☐ KO | Écran affiché |
| G6 | Admin entreprise de test, iPhone | Réglages › Pilotage › Rapports, période « Trimestre », fiche d'un département, « Exporter en CSV », « Rapport PDF » | « reçus », « remis », « Par transporteur » ; feuille de partage avec le fichier ; impression ouverte | ☐ OK ☐ KO | L'impression n'a jamais été jouée sur iPhone |

## 8. Décisions client

| N° | Décision | Compte et rôle | Geste | Résultat attendu | OK / KO | Noter si écart |
|---|---|---|---|---|---|---|
| H1 | D21, quatre rôles | Navette | Ouvrir `/reglages/comptes`, `/tableau-de-bord` | Renvoi à l'accueil | ☐ OK ☐ KO | Écran affiché |
| H2 | D21 | Département Finance | Chercher Léa Fontaine dans Colis et l'annuaire ; ouvrir `/scan` | Aucun colis ni salarié de Studio ; `/scan` renvoie à l'accueil | ☐ OK ☐ KO | Donnée vue |
| H3 | D24 | Département | Déjà joué en C2 | Confirmation au nombre, sans détail exigé | ☐ OK ☐ KO | |
| H4 | D25 | Navette, admin entreprise | Déjà joué en C5 et F1 | L'écart se voit des deux | ☐ OK ☐ KO | |
| H5 | D26 | Admin de l'app | Ouvrir `/colis`, `/reglages/annuaire`, `/tableau-de-bord`, puis la fiche et le Journal | Renvoi à l'accueil. Fiche : chiffres seuls, aucune adresse ni nom de salarié. Journal : création et invitation | ☐ OK ☐ KO | Donnée nominative vue |
| H6 | D27 | Admin entreprise de test | Comptes › Studio › « Changer le mot de passe » : provisoire, « Enregistrer » | Enregistré ; le téléphone déjà connecté n'est ni bloqué ni déconnecté | ☐ OK ☐ KO | Déconnexion |
| H7 | D27 | Département Studio, **autre navigateur** | Se connecter avec le mot de passe provisoire | « Choisissez votre mot de passe », rien d'autre tant qu'il n'est pas changé | ☐ OK ☐ KO | Écran affiché |
| H8 | D30 | Admin entreprise de test | Réglages › Fonctionnement : Signature « Obligatoire » | Pas de verrou ; « Modifié », « Enregistrer 1 changement » | ☐ OK ☐ KO | Réglage bloqué |
| H9 | D31 | Admin entreprise de test | « Enregistrer 1 changement » | Avant d'enregistrer : « Appliquer à N colis ? » (ou « Appliquer ce changement ? ») ; « Revoir » possible ; après : « 1 étape changée » | ☐ OK ☐ KO | N annoncé, N réel |
| H10 | D31 | Département Studio | Remettre un colis restant | « Faire signer » marqué « Obligatoire », « Remettre » grisé tant que la signature manque | ☐ OK ☐ KO | Colis où elle n'est pas demandée |

## 9. Ce qui attend l'activation de Brevo

**Décision d'Adam, à part de la recette.** Tant qu'elle n'est pas prise, cette partie reste non jouée,
sans que cela vaille KO. La clé vaut pour toutes les entreprises : poser `BREVO_API_KEY`,
`MAIL_FROM_ADDRESS` et `BREVO_WEBHOOK_TOKEN` ensemble, prévenir les agents, choisir une entreprise
pilote, et commencer par une boîte de test.

| N° | Compte et rôle | Geste | Résultat attendu | OK / KO | Noter si écart |
|---|---|---|---|---|---|
| I1 | Admin de l'app | Inviter un administrateur | L'e-mail part ; HTML juste dans Mail, Gmail, Outlook ; lien cliquable avec son `#` | ☐ OK ☐ KO | Client mail, rendu |
| I2 | Admin de l'app | « Obtenir un lien à copier » après un envoi | Nouveau lien, qui remplace celui de l'e-mail | ☐ OK ☐ KO | Échec sans message (connu) |
| I3 | Navette, département | Lot validé, dépôt confirmé (profil au dépôt) ; lot validé (profil au scan) | Un e-mail par destinataire, sans geste, au bon moment | ☐ OK ☐ KO | Colis sans e-mail ou reçu deux fois |
| I4 | Salarié de test | Ouvrir l'e-mail dans Mail, Gmail, Outlook, puis présenter le QR | QR lisible (tableau HTML et PNG joint), remise acceptée | ☐ OK ☐ KO | Client mail qui le casse |
| I5 | Admin entreprise de test | Profil en relances « Automatiques », attendre J+2 | Une seule relance | ☐ OK ☐ KO | Nombre de relances |
| I6 | Admin entreprise de test | Adresse qui rebondit | Remonte dans le suivi et les relances, webhook reçu | ☐ OK ☐ KO | Liste Colis : aucune alerte (connu) |
| I7 | Admin entreprise de test | Déclarer un domaine de test, poser les DNS, « Vérifier maintenant » | Domaine vérifié ; noms de `dns_records` conformes à l'écran | ☐ OK ☐ KO | SPF : l'API documentée n'en rend pas, le cahier en montre un |
| I8 | Admin entreprise de test | Retirer ce domaine, DNS en place, le redéclarer depuis une autre entreprise | **Bloquant si elle passe vérifiée sans preuve** | ☐ OK ☐ KO | Réponse de Brevo |
| I9 | Admin entreprise de test | Retirer le DNS d'un domaine vérifié, envoyer | Refus de Brevo : code exact. Un 401 ou 403 arrêterait toute la file | ☐ OK ☐ KO | Code, état de la file |

## 10. Première passe sur vrai iPhone (F35 à F42)

Rien de cette liste n'a été vu sur un appareil réel. Ce sont les « reste à voir » des tickets, à jouer
app à jour et app installée. Un KO ici ne bloque pas forcément : le noter, avec le modèle et la
version d'iOS.

| N° | Ticket | Compte et rôle | Geste | Résultat attendu | OK / KO | Noter si écart |
|---|---|---|---|---|---|---|
| J1 | YSL-118, YSL-119 | Les iPhone de la prod déjà connectés | Accepter la mise à jour, **sans se déconnecter** ; synchro, remise | Données gardées, rôle à jour | ☐ OK ☐ KO | Déconnexion, données perdues |
| J2 | YSL-118 | Rôle ancien, mode avion | Relancer en mode avion | Pas d'écran de connexion, réglages réduits jusqu'à la relecture de session | ☐ OK ☐ KO | Écran affiché |
| J3 | YSL-117 | Navette | Relance entre deux départements, remise en mode avion | Rien de perdu au retour du réseau | ☐ OK ☐ KO | File de synchro |
| J4 | YSL-124 | Admin entreprise | Fonctionnement : feuille « Colis touchés », toast | Au-dessus de la barre d'accueil | ☐ OK ☐ KO | Capture |
| J5 | YSL-128 | Admin entreprise | Annuaire : liste, formulaire, déplacement, filtres | Défilement juste, clavier sans recouvrement | ☐ OK ☐ KO | Capture |
| J6 | YSL-129 | Département | Annuaire : liste, formulaire, demande de déplacement | Idem | ☐ OK ☐ KO | Capture |
| J7 | YSL-130 | Navette | Vérification et feuille hors annuaire avec deux homonymes | Les deux proposés, département affiché | ☐ OK ☐ KO | Capture |
| J8 | YSL-131 | Navette | Version ancienne après un colis de tournée, mise à jour, relecture | Colis présents, statuts justes | ☐ OK ☐ KO | Statut lu |
| J9 | YSL-119 | Département | Bouton Scanner | Absent ; « Remettre » présent | ☐ OK ☐ KO | Capture |
| J10 | YSL-132 | Navette | Lot en profil à tournée, choix du département, ancien iPhone | Ancien iPhone : colis retirés, pas de déconnexion | ☐ OK ☐ KO | Déconnexion |
| J11 | YSL-83 | Compte suspendu puis réactivé | Suspendre, relancer, réactiver ; envois en attente | « Compte suspendu », données et envois intacts | ☐ OK ☐ KO | Donnée perdue |
| J12 | YSL-83 | Compte de test **jetable** | Révoquer | Photos et preuves effacées à la requête suivante | ☐ OK ☐ KO | Donnée restante |
| J13 | YSL-121 | Entreprise de test | Suspendre, session perdue, reconnexion en app installée | « Votre entreprise est suspendue », données reprises | ☐ OK ☐ KO | Donnée perdue |
| J14 | YSL-122 | Invité | Lien depuis Mail, Safari, mot de passe, installation, connexion dans l'app | Connexion ; noter ce que fait le trousseau | ☐ OK ☐ KO | Mot de passe non repris |
| J15 | YSL-125 | Admin de l'app, iPhone | Étape Fonctionnement, défiler jusqu'à Relances | Au-dessus de la barre | ☐ OK ☐ KO | Capture |
| J16 | YSL-133 | Navette | Tournée de plusieurs départements en mode avion, relance en mode avion, mise à jour | Rien de perdu, rendu juste sous la barre d'état | ☐ OK ☐ KO | Capture |
| J17 | YSL-134 | Navette | Dépôt en mode avion, QR imprimé | Part en file, puis confirmable | ☐ OK ☐ KO | Temps de lecture |
| J18 | YSL-134 | Admin entreprise | Imprimer l'affiche | Dialogue réel, QR net | ☐ OK ☐ KO | Rendu papier |
| J19 | YSL-136 | Département | Remise en mode avion ; QR d'un autre département en ligne ; scan du colis exigé | Hors ligne : remise gardée, QR d'ailleurs refusé | ☐ OK ☐ KO | Message exact |
| J20 | YSL-135 | Département | `mailto` depuis son écran, ligne E-mails, retour de la messagerie, mise à jour de la PWA | Brouillon complet, retour sur l'écran | ☐ OK ☐ KO | Écran au retour |
| J21 | YSL-137 | Admin entreprise | Vue d'ensemble depuis Réglages, toucher un colis à régulariser, hors ligne | Bandeau hors ligne. Le panneau s'ouvre sous la liste : peut-on le croire absent ? | ☐ OK ☐ KO | Colis visibles avant le panneau |
| J22 | YSL-82 | Département | Colis, bandeau de dépôt, « Remettre » de la fiche jusqu'au QR, historique, lieu | Tout s'ouvre, lieu en lecture | ☐ OK ☐ KO | Capture |
| J23 | YSL-88 | Admin entreprise | Déjà joué en G6 | | ☐ OK ☐ KO | |

## Après la recette

- [ ] Rendre ce document rempli, avec les captures des KO, et une ligne de conclusion : accepté, ou
      accepté avec réserves, ou refusé.
- [ ] Supprimer l'entreprise « Recette JJ/MM » (fiche › « Supprimer ») : elle part avec ses colis, son
      annuaire et ses comptes. Le journal de la plateforme en garde la trace, c'est prévu. Les
      téléphones du test s'effacent à leur requête suivante.
- [ ] Une fois **la conversion validée** (partie 10, J1 à J3) : supprimer la sauvegarde
      `/root/ysl-backups/avant-conversion-20261031.dump` sur le serveur. C'est aussi ce qu'attend la
      migration qui retire les anciennes colonnes.
- [ ] Décider de l'activation de Brevo (partie 9).

## Ce que le rejeu a vérifié

Le script a été déroulé par Playwright sur une base de démo locale, en Chromium et en WebKit, sans
Brevo : parties 1 à 8, écrans et libellés, faits en base. Cela prouve que le script se déroule, **pas
que la recette est faite.**

Pas joué, et donc à regarder d'abord sur le vrai appareil : vraie caméra et vraies étiquettes (numéro
tapé, QR de dépôt montré par une caméra simulée), messagerie réelle (`mailto:` non ouvert), « Partager
avec le QR » et remise par QR (D4, E4), dialogue d'impression (G4), impression sur papier, mode avion,
signature tracée au doigt, export et PDF sur iPhone, parties 9 et 10.
