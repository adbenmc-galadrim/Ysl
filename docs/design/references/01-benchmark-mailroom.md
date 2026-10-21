# 01 - Benchmark des apps mailroom / gestion de colis entrants

> Objectif : arrêter d'inventer. Ce document décrit comment sont faites, écran par écran, les apps
> professionnelles de réception de colis qui fonctionnent, pour en tirer les écrans de « Courrier YSL »
> (PWA iPhone, agent du service courrier, scan en série → vérification → e-mail au salarié → remise QR/PIN/signature).
>
> Méthode : API publique App Store (`itunes.apple.com/lookup` et `/rss/customerreviews`) pour les notes,
> le volume d'avis, les descriptions, les captures et les avis récents ; centres d'aide (Envoy, PackageX,
> Parcel Tracker) ; G2 et Capterra pour les avis. Relevé fait le 21/10/2026. Toutes les captures ci-dessous
> ont été téléchargées dans `mailroom/` et regardées une par une.
>
> Attention : les captures App Store sont des visuels marketing, avec titres et fonds ajoutés. Seul
> l'écran à l'intérieur du téléphone compte. Les captures Envoy viennent du centre d'aide : ce sont de vraies
> captures d'écran.

---

## 1. Tableau comparatif

Notes App Store US (sur 5), avec le nombre de notes entre parenthèses. « - » : pas assez de notes pour
qu'Apple affiche une moyenne.

| App (éditeur) | Cible | Note App Store | Autres notes | Scan | Choix destinataire | Remise | Navigation | Pertinence pour nous |
|---|---|---|---|---|---|---|---|---|
| **Parcel Tracker - Mailroom** (deepfinity / ParcelTracker) | Entreprises, résidences, hôtels | **4,6 (35)** | G2 4,7 (167), Capterra 4,8 | Caméra plein écran, détection auto nom + code-barres, **toast « Last scanned » + Undo**, rafale | Auto-match OCR avec surnoms et départements, puis carte destinataire en bas de l'écran | QR dans l'e-mail, signature, photo, notes | **5 onglets** : In / Out / Move / Manage / Settings | ★★★ référence n°1 |
| **Verkada Mailroom** (Verkada) | Entreprises (bureaux) | 4,5 (15) | - | Plein écran, **viseur rond** « recipient name / tracking number », bouton « Manual Entry » | OCR, puis feuille de vérification par-dessus la caméra | « Mark as Picked Up », photo de dépôt | Liste avec segments Waiting / Picked Up et FAB scan | ★★★ référence n°2 (UI la plus soignée) |
| **Envoy** (module Deliveries) | Entreprises (bureaux) | **4,65 (17 831)** pour toute l'app Workplace | Capterra 4,8 (428), G2 4,4 (164) | Photo de l'étiquette, nom à placer dans une **zone cadrée**, enchaînement des photos | OCR + annuaire ; si échec : **« No recipient found. Add one or retake the photo »**, puis recherche avec « Recent » | Boutons dans l'e-mail ou Slack : **Mark as picked up / Snooze / This isn't mine** | Onglet « Up next » avec alertes jaunes | ★★★ référence n°3 (même contexte : salariés, annuaire, e-mail) |
| **PackageX Receive** / Mailroom by PackageX | Universités, bureaux, coworking | 4,4 (7) / 4,1 (19) | - | Plein écran, shutter central, **compteur de lot** (« 12 › »), modes Scan In / Scan Out | Bacs « Complete » et **« Scan Issues »** (correspondances multiples, puis suggestions) | Signature plein écran, Notify / Pickup | 5 onglets : Check Out / Items / (scan) / Pending / Actions | ★★ bon modèle de rafale et d'exceptions |
| **Notifii Track** (Notifii) | Résidences, campus, bureaux | 3,3 (14) | Capterra 4,8 (542) | Scan code-barres seul, cadre rouge | Champ texte prérempli (surligné jaune) | Liste à cases à cocher, puis signature, photo d'ID et notes | 4 onglets : Log In / Log Out / Search / More | ★ modèle « formulaire » daté, utile en contre-exemple |
| **Package Zen** | Bureaux, hôtels | 4,55 (22) | G2 | **Photo et on enchaîne, sans attente** (traitement serveur en tâche de fond) | Automatique ; destinataire inconnu → fiche créée et alerte | Photo de sortie + signature, le dossier se clôt tout seul | - | ★★ la philosophie « zéro attente » |
| **Greetly Digital Mailroom** | Bureaux | 4,86 (59) | - | Photo | **Liste avec recherche, avatar et e-mail, ligne cochée verte**, puis Confirm | Check-out par carte photo | 2 grosses tuiles check-in / check-out | ★ choix destinataire simple |
| **Avigilon Alta Mailroom** (Motorola) | Entreprises | - (0) | - | Photo plein écran | Annuaire Alta Access | E-mail avec **QR de retrait**, « Mark as picked up » | Liste « Packages » et bouton « Scan label or QR code » | ★★ détail colis et historique |
| **DeliveryOS** (FacilityOS) | Entreprises | - (0) | - | Scan, puis formulaire (Retake / Submit), mode Bulk Scan | Champ de recherche | **Multi-colis cochés + signature + écran « Scan Submitted »** | - | ★★ flux de remise propre |
| **GEO Staff** (BuildingLink) | Résidences (gardiens) | 4,36 (827) | - | ImageR : « Scanning for the information… », bouton **RESCAN par champ** | Unité + nom | Signature | 5 onglets et grille de tuiles | ★ rescan champ par champ |
| **SendSuite Tracking Online** (Pitney Bowes) | Grandes entreprises | **1,9 (9)** | - | Code-barres à environ 15 cm, auto | Saisie clavier libre | Signature plein écran | Accueil à 4 icônes | Contre-exemple (avis : connexion impossible) |
| PitneyTrack / ParcelPoint (Pitney Bowes) | Idem | 3,1 (8) / 1,8 (20) | - | - | - | - | - | Contre-exemple |
| Package Concierge | Consignes (résidents) | 1,5 (44) | - | - | - | - | - | Hors cible (app résident) |
| Smiota | Consignes (résidents) | 4,1 (537) | - | - | - | Ouverture de casier par tap | - | Hors cible |
| Luxer One | Consignes (résidents) | 4,73 (31 892) | - | - | - | Code ou QR casier | - | Hors cible ; modèle du retrait par code |
| Parcel Pending (Quadient) | Consignes (résidents) | 4,83 (56 052) pour l'ancienne app, 4,14 (1 408) pour la nouvelle | - | - | - | Code ou QR | - | Hors cible ; modèle du retrait par code |
| Amazon Hub | Consignes | 2,6 (45) | - | - | - | - | - | Hors cible |
| Mailroom by Ricoh, Receivd, SendPro Receiving | - | **Pas d'app iPhone publique trouvée** | - | - | - | - | - | Non évaluables |

Constat : les apps « agent » ont peu d'avis sur l'App Store, parce qu'elles s'installent sur quelques
appareils par site. Les volumes importants (Luxer, Parcel Pending) concernent des apps **destinataires**
de consignes. Côté agent, les signaux fiables sont G2 et Capterra (Parcel Tracker 4,7-4,8, Notifii 4,8,
Envoy 4,4-4,8) et le contenu des avis App Store.

Sources des notes : `https://itunes.apple.com/lookup?id=<id>` pour les identifiants 1491350064, 1631622141,
983102576, 1615717057, 1441409759, 872446898, 817890100, 1330288641, 6502196111, 6747896606, 465966658,
1165888985, 6443595811, 6670161682, 1096327341, 1215491050, 1440094075, 1352095998, 6467768006 et 6744907508.
Sites : [G2 Envoy vs Parcel Tracker](https://www.g2.com/compare/envoy-workplace-vs-parcel-tracker-mailroom),
[Capterra Envoy](https://www.capterra.com/p/143721/Envoy/reviews/),
[Capterra Notifii](https://www.capterra.com/p/136495/Notifii/reviews/),
[parceltracker.com](https://parceltracker.com/).

---

## 2. Les 3 meilleures, écran par écran

### 2.1 Parcel Tracker - Mailroom (la meilleure note agent et l'UI la plus moderne)

Sources : [App Store](https://apps.apple.com/app/id1491350064), [site](https://parceltracker.com/),
[batch scan](https://support.parceltracker.com/en/articles/316785-batch-scan),
[scan multiple](https://support.parceltracker.com/en/articles/165649-can-i-scan-and-log-multiple-parcels-and-notify-all-recipients-at-once),
[batch collection](https://support.parceltracker.com/en/articles/177894-how-to-enable-and-use-batch-collection).

**Scan**, voir `mailroom/parceltracker-scan-dernier-scanne-undo.jpg` :
- La caméra occupe tout l'écran, sans cadre dessiné : l'étiquette est lue où qu'elle soit dans l'image.
- En haut, un **toast sombre translucide « Last scanned »** affiche le nom en gras, la pièce en gris et le
  tracking avec une icône code-barres. À droite, séparé par un trait : **« ↶ Undo »**. Le dernier scan reste
  visible et annulable sans quitter la caméra.
- Au centre, une **pastille verte « New Parcel Added »** confirme brièvement chaque ajout.
- Au-dessus du shutter, un **fil d'étapes** « ✓ Recipient → Scan Barcode » : le nom est trouvé, l'app
  attend le code-barres. L'agent sait ce que la caméra cherche.
- En bas : un gros shutter blanc entouré d'un **anneau de progression teal**, un bouton rond « saisie
  manuelle » à gauche (icône code-barres et crayon), un bouton rond « bac / liste » à droite.
- Une **bottom sheet** blanche affiche le destinataire détecté : nom, pièce, tags colorés (« Club member »,
  « Premium », « +2 »), un X pour rejeter et un cadenas.

**Accueil / tableau de bord**, voir `mailroom/parceltracker-accueil-compteurs.jpg` :
- En-tête : sélecteur de site « MailRoom A, Current site » et état **« Synced »** (vert, icône nuage).
- Un grand titre centré « 2 Parcels » avec le lien « Checked-out today › ».
- **3 tuiles compteurs colorées** : Held 62 (lilas), **Overdue 12 (rose)**, Dispatch 9 (gris).
- Une liste de raccourcis « Scan by Recipient / Drop-off Location / Courier » avec compteurs et chevrons.
- **Tab bar à 5 onglets** sur fond blanc, l'onglet actif en pastille teal pleine : In, Out, Move, Manage,
  Settings.

**Liste des colis scannés**, voir `mailroom/parceltracker-liste-colis-scannes.jpg` :
- Barre de navigation « ← Scanned Parcels » avec un filtre (entonnoir), un champ « Search… » arrondi gris.
- Sections groupées par destinataire (« Justin Casper 2 »).
- Chaque ligne a une **miniature de la photo d'étiquette** à gauche, puis une pile de métadonnées avec
  icônes : date et heure, ID interne, tracking, **logo et nom du transporteur** (Royal Mail, DHL), lieu de
  stockage. Viennent ensuite des **chips de priorité** (« Fragile » rose, « Urgent » rose foncé).
- Densité moyenne : environ 2,5 colis par écran, la photo sert de repère visuel.

**Remise (check-out)**, voir `mailroom/parceltracker-remise-checkout.jpg` :
- Une bottom sheet « ← Check Out » avec une liste de lignes : Signature « Added ✓ » (vert), Add Notes
  « Optional », Add Photo « Optional », Notify Recipients (interrupteur).
- Un bouton plein noir pleine largeur : **« Complete Checkout »**.
- La signature et la photo de remise apparaissent en vignettes par-dessus.
- Le retrait se fait par **QR envoyé dans la notification** et scanné par l'agent, puis signature.

**Style** : fond blanc, accent teal (#2EC4B6 environ), tuiles pastel, typographie sans-serif géométrique,
coins de 12 à 16 px, icônes en trait. Sobre et dense, sans décoration.

**Avis** : on loue « intuitif », « scanner, notifier, gérer avec son téléphone (aucun matériel) », « la
dernière mise à jour UI et scan rend le scan beaucoup plus rapide quand le nom sur l'étiquette est un peu
différent », l'import CSV des destinataires et les photos de preuve. On critique la synchronisation et
l'upload des photos, et une certaine lenteur en scan multiple (avis de 2022). G2 : jugée plus simple
qu'Envoy à utiliser, configurer et administrer.

### 2.2 Verkada Mailroom (UI la plus lisible, contexte bureau)

Sources : [App Store](https://apps.apple.com/app/id1631622141),
[blog Verkada](https://www.verkada.com/blog/introducing-verkada-mailroom/),
[International Security Journal](https://internationalsecurityjournal.com/?p=42873).

**Liste « Waiting »**, voir `mailroom/verkada-liste-en-attente.jpg` :
- En-tête : une loupe à gauche, un **segmented control « Waiting | Picked Up »** centré (pastille noire
  pour l'onglet actif), un menu hamburger à droite.
- Sections **par jour d'arrivée** (« Arrived Friday, June 4 »).
- Chaque ligne est une carte blanche : nom en medium, **logo du transporteur** dessous (ups, amazon, USPS,
  FedEx), et à droite **deux vignettes accolées : l'avatar du salarié et la photo du colis**.
- Un **FAB rond noir** (icône colis et « + ») en bas à gauche lance le scan.
- Aucune tab bar : l'app tient sur une seule liste.

**Scan**, voir `mailroom/verkada-scan-viseur-rond.jpg` :
- La caméra occupe tout l'écran, un bouton retour rond bleu en haut à gauche.
- Au centre, un **viseur circulaire annoté** : un anneau avec le texte courbe « RECIPIENT NAME » en haut
  et « TRACKING NUMBER » en bas. Il indique ce que l'app lit.
- Un seul bouton en bas : pilule bleue **« Manual Entry »**. Pas de shutter : la capture est automatique.

**Vérification**, voir `mailroom/verkada-verification-feuille.jpg` :
- Une **carte modale blanche par-dessus la caméra floutée**. L'agent reste dans le flux de scan.
- Champs, dans cet ordre : *Recipient* (label bleu, nom en grand) ; tracking en monospace léger et **logo
  USPS** à droite ; rangée de photos (case « + caméra » bleu pâle et 2 vignettes) ; pilule « 3rd Floor
  Mail Room › » (lieu) ; pilule noire « 5 tags selected › » ; *Notes* sur plusieurs lignes.
- Deux boutons pilule en bas : **Cancel** (contour) et **Save** (plein bleu).

**Notification / étiquette**, voir `mailroom/verkada-etiquette-et-sms.jpg` :
- Une étiquette imprimée automatiquement : date « FRI 17 JUN », **nom en très gros caractères gras**, QR.
- SMS : « 📦 Roxanne - you have a delivery at 3rd Floor Mail Room (Simplify HQ). After you pick it up,
  please reply "done"… » avec un lien court. Relance si le colis n'est pas retiré sous 24 h.

**Détail et remise**, voir `mailroom/verkada-detail-colis-remise.jpg` :
- Photo du colis en haut (carrousel avec points) et bouton « Add Dropoff Photo ».
- Une carte : **nom en grand sur deux lignes et avatar rond** ; « Arrived Jun 17, Fri 12:36 PM » ; bouton
  pilule bleu **« Mark as Picked Up »** ; tags en chips bleu pâle (Oversized, Fragile, Very Heavy, Box) ;
  lieu avec icône pin ; tracking et logo transporteur ; note.

**Style** : blanc et gris très clair, un seul accent bleu (#1E88C8 environ), noir pour les contrôles
actifs, coins très arrondis (pilules), typographie sans-serif humaniste, beaucoup d'air. C'est la
référence de lisibilité.

**Avis** (peu nombreux) : « Very intuitive and useful », « simple tool for small to mid-sized
facilities ». Le reste concerne l'écosystème Verkada.

### 2.3 Envoy Deliveries (même contexte qu'YSL : bureau, annuaire salariés, e-mail)

Sources : [Recording deliveries](https://help.envoy.com/how-to-record-deliveries/),
[No recipient found](https://help.envoy.com/how-to-correct-unprocessed-deliveries/),
[features](https://envoy.com/products/deliveries/features), [App Store](https://apps.apple.com/app/id983102576).

**Scan**, voir `mailroom/envoy-scan-en-serie-geste.jpg` (geste réel) et
`mailroom/envoy-scan-destinataire-introuvable.png` :
- On ouvre l'app et on tape « + ». La caméra s'ouvre en plein écran, fond sombre. Consigne : « placez le
  **nom du destinataire dans la zone délimitée**, mais capturez toute l'étiquette », puis shutter.
  **On recommence pour le colis suivant sans quitter la caméra.** Le GIF montre un colis par seconde
  environ : l'agent pose le colis, photographie, prend le suivant.
- Après la capture, une **bottom sheet sombre « Delivery recipient »** monte sur l'image. En cas d'échec,
  le texte ambre dit **« No recipient found. Add one or retake the photo. »**, avec un gros bouton rouge
  **« Add recipient »** et un X pour reprendre la photo.
- « Add recipient » ouvre une feuille sombre avec la section **RECENT** (nom et e-mail) et le clavier
  ouvert : la recherche démarre au premier caractère.
- Un colis non identifié est **quand même enregistré** (pas de perte), mais sans notification. Il
  apparaît en **alerte jaune dans l'onglet « Up next »**. Un e-mail est aussi envoyé à l'admin
  (`mailroom/envoy-email-colis-sans-destinataire.png` : « You have a package that doesn't have a recipient »,
  transporteur, date, lieu, note, lien rouge « Edit recipient »).

**Correction (dashboard web)**, voir `mailroom/envoy-dashboard-correction-destinataire.jpg` :
- Le « Delivery log » est un tableau : miniature photo, destinataire (ligne **« Unidentified recipient »
  en orange** avec liseré à gauche), zone, transporteur, date de réception, lien rouge « Mark as picked up ».
- Le détail suit l'ordre : formulaire à gauche (Recipient name avec liste déroulante et recherche,
  Delivery area, Notes, Carrier, Tracking, Received « by Carrie Lewis », Picked up), **photo de
  l'étiquette à droite** pour vérifier d'un coup d'œil.

**Notification**, voir `mailroom/envoy-notification-email-slack-teams.png` :
- Même contenu sur trois canaux (e-mail, Slack, Teams) : « RECIPIENT » en petites capitales rouges et le
  nom en gras ; Location, Address, **Delivery area**, **Delivery notes** (« Bottom shelf, yellow
  package »), Carrier, Date ; **photo de l'étiquette** à droite.
- **Trois actions directement dans l'e-mail** : **Mark as picked up** (bouton plein rouge), **Snooze**,
  **This isn't mine**. Relance quotidienne jusqu'au retrait.

**Style** : rouge Envoy (#F44336 environ) comme seul accent, blanc, gris clair, labels en petites
capitales, sans-serif. Scan en mode sombre.

**Avis** : on loue la facilité d'usage et la notification automatique. On critique
(App Store, 1★, « Package management issues ») : *« Pourquoi ne plus afficher le nom du destinataire dans la
zone Deliveries ? Pourquoi faut-il un clic de plus ? Pourquoi ne peut-on pas scanner depuis l'onglet
Deliveries et faut-il revenir à l'accueil ? Trois clics de plus, ça prend du temps. »*
Capterra : *« J'aimerais scanner l'étiquette pour marquer le colis remis plutôt que chercher le
destinataire. »* Déconnexions intempestives.

---

## 3. Les autres, en bref (ce qu'on en retient)

- **PackageX Receive**, voir `mailroom/packagex-scan-rafale-compteur.jpg`, `packagex-liste-items-tags.jpg`,
  `packagex-signature-checkout.jpg`, `packagex-detail-item.jpg`. Scan plein écran, flash et changement
  de caméra en haut, toggles « T » (texte) et code-barres verts. En bas : vignette du dernier scan à
  gauche, shutter, **pastille violette « 12 › »** qui compte le lot en cours, libellé « Scan Inbound ».
  Après le lot, deux bacs : *Complete* (bouton « Notify All ») et *Scan Issues* (correspondances
  multiples ou partielles : « Select the recipient » propose des suggestions, ou « Choose another
  recipient »). La liste « Items » a des segments Inbound (avec badge) / Outbound, la recherche, des lignes
  avec miniature, nom, tracking tronqué, transporteur, **badge de statut coloré** (Scan & Send bleu,
  Forward jaune, Hold violet, Destroy rouge) et l'étagère (« SHELF B »). La signature est en plein écran
  avec Done et reset. Tab bar : 5 onglets, dont un shutter central surélevé.
  Sources : [scanning in packages](https://help.packagex.io/en/knowledge/scanning-in-packages),
  [scan issues](https://help.packagex.io/en/knowledge/scan-issues).
- **Notifii Track**, voir `mailroom/notifii-formulaire-log-in.jpg`, `notifii-scan-code-barres.jpg`,
  `notifii-liste-selection-remise.jpg`, `notifii-remise-signature.jpg`. Modèle formulaire : Recipient
  (champ surligné jaune), Tracking, Carrier, Shelf, cases Urgent/Fragile/Perishable/Heavy, message. Scan
  du code-barres seul, cadre rouge. Remise : liste filtrable à cases à cocher, « Next », puis statut,
  signature, notes et photo d'ID. 4 onglets bleus. Avis : *« L'OCR n'est pas rapide… j'aimerais
  scanner en continu, que l'OCR propose une correspondance partielle et que l'utilisateur
  confirme »* ; crash après mise à jour ; *« caméra qui reste active »* ; *« la sortie d'un colis prend
  deux écrans »* (Capterra).
- **Package Zen**, voir `mailroom/packagezen-scan-photo.jpg`, `packagezen-checkout-photo.jpg`. Un seul
  geste, la photo. *« Le seul vraiment AUTOMATISÉ : on prend la photo et on passe au suivant sans
  interruption. Les 5 autres apps que j'ai utilisées font attendre. »* Les images que le téléphone ne
  traite pas tout de suite partent au serveur pendant qu'on continue. Destinataire inconnu : fiche créée
  et alerte.
- **Greetly**, voir `mailroom/greetly-choix-destinataire.jpg`, `greetly-recap-colis.jpg`. « Select
  recipient » : champ « Search users », lignes avatar + nom + e-mail, **ligne choisie bordée de vert avec
  coche**, bouton « CONFIRM » pleine largeur. Récap : cartes photo, « Arrived just now », « CHECK OUT ».
- **Avigilon Alta Mailroom**, voir `mailroom/avigilon-scan-plein-ecran.jpg`, `avigilon-detail-historique.jpg`,
  `avigilon-email-qr-retrait.jpg`. Détail en liste groupée iOS (Recipient > All packages 11 ; Mailroom,
  Status « Awaiting pickup », Tracking, Carrier, Sender, Weight) et **historique horodaté** (Initial scan →
  Notification sent → Package picked up). E-mail avec **QR de retrait**. Bouton principal « Scan label or
  QR code » : **le même scanner sert à l'arrivée et au retrait**.
- **DeliveryOS**, voir `mailroom/deliveryos-formulaire-scan.jpg`, `deliveryos-remise-multi-colis.jpg`,
  `deliveryos-signature.jpg`, `deliveryos-confirmation.jpg`. Remise : en-tête salarié (« Frank Landwer,
  2 Parcels »), colis cochés (miniature, date, tracking, transporteur), pied fixe « 2 Parcels selected for
  pick up » et « Sign for Pick Up ». Signature « Sign Here » avec le nom imprimé dessous. Confirmation
  plein écran : pictogramme colis et coche verte, « Scan Submitted », « Finished ».
- **BuildingLink GEO / ImageR**. Pendant la lecture, un bandeau « Scanning for the information… » ; les
  champs détectés (unité + nom, tracking) ont chacun **un bouton RESCAN** à droite. Avis très négatifs
  sur la stabilité (déconnexions, demande de note après chaque scan).
- **SendSuite Tracking Online**, voir `mailroom/sendsuite-scan-code-barres.jpg`,
  `sendsuite-formulaire-reception.jpg`. Consigne texte « Tenez la caméra à environ 15 cm, attendez le scan
  automatique », puis formulaire Tracking / Carrier / Status / **Recipient saisi au clavier**. Note de
  1,9 : tous les avis récents parlent d'impossibilité de se connecter.

---

## 4. Patterns récurrents qui marchent

1. **Caméra plein écran, l'étiquette entière dans l'image, lecture OCR du nom et du tracking en une
   capture.** Personne parmi les meilleures ne demande de viser un code-barres puis de taper le nom.
   Le cadrage est léger : zone pour le nom (Envoy), viseur rond annoté (Verkada), ou aucun cadre
   (Parcel Tracker).
2. **Rester dans la caméra entre deux colis.** Rafale avec compteur (PackageX « 12 › »), toast « Last
   scanned » (Parcel Tracker), ou photo puis colis suivant (Envoy, Package Zen). Revenir à une liste après
   chaque colis est le défaut le plus critiqué.
3. **Feedback immédiat après chaque scan, sans bloquer** : pastille « New Parcel Added », nom du dernier
   destinataire détecté, **Undo** à portée de pouce.
4. **Le traitement ne doit pas bloquer l'agent** : OCR serveur en tâche de fond, statut « Synced » visible.
   Les échecs vont dans un **bac d'exceptions** (Scan Issues, Up next en jaune) au lieu de bloquer le flux.
5. **Un colis non reconnu est enregistré quand même.** On ne perd jamais un colis : il passe en
   « destinataire à identifier » et l'app le signale.
6. **La correspondance floue propose, l'humain confirme** : suggestions (homonymes, surnoms,
   départements), section « Récents », recherche dès le premier caractère, lignes avatar + nom + e-mail.
7. **La vérification se fait dans une feuille par-dessus la caméra** (Verkada, Envoy, Parcel Tracker) :
   destinataire en premier et en gros, tracking et logo transporteur, photo, lieu de stockage, tags,
   note. Deux boutons (Annuler / Enregistrer).
8. **La photo de l'étiquette accompagne le colis partout** : miniature dans la liste, photo dans le
   détail, photo dans l'e-mail au salarié.
9. **Le logo du transporteur plutôt que le texte** dans les listes (UPS, FedEx, USPS, DHL, Amazon).
10. **Liste segmentée par statut** (Waiting / Picked Up, Inbound / Outbound, Held / Overdue), **groupée
    par jour** ou par destinataire, avec recherche en haut. Le compteur de colis en retard est mis en
    évidence (rose ou rouge).
11. **La notification contient tout pour retrouver le colis** : lieu précis (étage, salle), note
    (« étagère du bas, colis jaune »), photo, transporteur, et **actions dans l'e-mail** (« Je l'ai
    récupéré », « Ce n'est pas à moi », « Rappeler plus tard »). **Relance automatique** (24 h ou
    quotidienne).
12. **Remise : QR (ou code) présenté par le destinataire, scanné par le même scanner, puis signature au
    doigt et photo facultative.** Plusieurs colis d'une même personne se remettent en une fois (cases
    cochées, « 2 colis sélectionnés », une seule signature). Écran de confirmation net.
13. **Historique horodaté par colis** (reçu par X à telle heure, notifié, relancé, remis à Y avec
    signature) : c'est la chaîne de responsabilité.
14. **Saisie manuelle toujours disponible mais secondaire** : bouton « Manual Entry » ou icône crayon sur
    l'écran de scan, jamais l'entrée principale.
15. **Style** : fond blanc ou gris très clair, **un seul accent** (teal, bleu, rouge), noir pour l'action
    principale, pilules et coins de 12 à 16 px, sans-serif, chips pastel pour les tags. Scan sombre.
    Navigation courte : soit une liste unique avec un bouton de scan (Verkada), soit 4 ou 5 onglets avec
    le scan en premier ou au centre.

---

## 5. Anti-patterns relevés dans les avis

| Anti-pattern | Où | Citation / constat |
|---|---|---|
| Attendre la fin de l'OCR avant de pouvoir scanner le suivant | Notifii, « 5 autres apps » | « The OCR is not fast… continue scanning packages » ; « the others let you scan a picture, but then you have to wait » (avis Package Zen) |
| Point d'entrée du scan éloigné de la liste, clics en trop | Envoy | « Why can't you scan a package from deliveries area? … Adds three clicks » |
| Masquer le nom du destinataire dans la liste | Envoy | « Why did envoy stop listing package recipient name… another click » |
| Remise qui oblige à chercher le destinataire au lieu de scanner | Envoy (Capterra) | « scan labels to mark packages delivered, rather than searching for the recipient » |
| Remise étalée sur plusieurs écrans | Notifii (Capterra) | « signing a package out takes two screens », mise en page mobile jugée mauvaise |
| Formulaire à remplir comme flux principal | Notifii, SendSuite | Champs empilés, destinataire saisi au clavier (voir captures) |
| Déconnexions et sessions qui expirent | Envoy, BuildingLink, SendSuite | « kept logging them out », « prompt to log out every time I type » ; SendSuite à 1,9 à cause de la connexion |
| Instabilité après mise à jour, perte de travail | Notifii, BuildingLink | crash au démarrage, saisies effacées, « stuck in progress » |
| Demander une note dans l'app après chaque scan | BuildingLink | « stop asking me to rate it after every scan » |
| Caméra qui reste active hors usage | Notifii | « shows that my camera is still active. This is very concerning » |
| Annuaire écrasé par la synchro nocturne | Notifii (Capterra) | « the database is updated nightly so whatever I add is removed » |
| Synchro et upload photo peu fiables | Parcel Tracker | « with a few fixes - like syncing and photo uploads » |

---

## 6. Recommandations concrètes pour Courrier YSL

### Scan (écran d'arrivée par défaut de l'agent)
- **Caméra plein écran sombre, sans cadre rigide.** Un repère léger (4 coins discrets, ou le viseur rond
  de Verkada) et une ligne d'aide : « Cadrez toute l'étiquette ».
- **Capture automatique** quand une étiquette nette est détectée, avec shutter manuel en secours (gros
  bouton central, anneau de progression pendant la lecture, comme Parcel Tracker).
- **Mode rafale par défaut** : après chaque capture, une pastille « Colis ajouté » (environ 1 s) et un
  **toast en haut « Dernier : Prénom NOM · Transporteur · …4521 | Annuler »**. Compteur de lot en bas à
  droite (« 7 › ») qui ouvre la file à vérifier.
- L'OCR tourne en tâche de fond, sans attente. L'agent peut enchaîner 20 colis puis vérifier.
- Bas de l'écran : à gauche « Saisie manuelle » (icône crayon), au centre le shutter, à droite le
  compteur et la file. Fil d'état au-dessus du shutter : « ✓ Nom → ✓ Suivi → Transporteur ».
- Indicateur réseau et synchro discret (« Synchronisé » / « Hors ligne, 3 en attente ») : la PWA doit
  garder les photos en local et les envoyer au retour du réseau.

### Vérification d'un colis
- **Une feuille par-dessus la caméra floutée** (modèle Verkada) ou une file « À vérifier » carte par
  carte après la rafale. Ordre : **Destinataire** (nom en grand, service ou étage dessous, avatar ou
  initiales, indice de confiance discret) → **Suivi** (monospace, logo transporteur, bouton « Relire »
  par champ façon BuildingLink) → **photo de l'étiquette** (zoom au tap) → **lieu de stockage** (pilule
  « Courrier RDC › ») → **tags** (Fragile, Volumineux, Confidentiel, Urgent) → **note**.
- Deux boutons : « Corriger » (contour) et **« Valider et notifier »** (plein). Swipe pour passer au
  suivant dans la file.
- Les champs incertains sont signalés en ambre (pas en rouge) avec la valeur proposée : on confirme d'un
  tap.

### Choix du destinataire
- Ouvert automatiquement si l'OCR échoue, avec le texte d'Envoy : « Destinataire non trouvé.
  Choisissez-le ou reprenez la photo. »
- **Suggestions d'abord** : 1 à 3 correspondances floues (homonymes, variantes, service), puis
  **« Récents »**, puis recherche avec clavier ouvert et résultat dès la première lettre.
- Ligne : avatar ou initiales, **Prénom NOM**, service et étage, e-mail en gris. Sélection par coche et
  liseré (Greetly), confirmation immédiate.
- Cas « inconnu de l'annuaire » ou « départ » : enregistrer quand même avec le statut **« À identifier »**
  (jamais bloquant), le mettre dans le bac d'exceptions et le compter sur l'accueil.

### Liste des colis
- **Segments en haut** : *À notifier / En attente de retrait / Remis* (ou *En attente / Remis*, avec un
  bac d'exceptions au-dessus si non vide, en jaune, façon « Up next »).
- **Groupement par jour d'arrivée**, recherche en haut (nom, suivi, transporteur), filtres en chips
  (transporteur, tag, « En retard > 3 j »).
- **Ligne type** : nom en medium et service ; logo transporteur et 4 derniers chiffres du suivi ; à droite
  la **miniature de la photo d'étiquette** et l'âge (« 2 j ») ; chips de tag. Densité visée : environ
  6 lignes par écran d'iPhone. Les cartes avec grande photo (Parcel Tracker) sont trop basses pour un
  gros volume.
- En tête de l'accueil, **3 compteurs** : En attente, **En retard** (couleur d'alerte), Remis aujourd'hui.
- **Scan accessible depuis la liste** (FAB ou onglet central). C'est la critique principale faite à Envoy.

### Remise
- Point d'entrée : **« Remettre » ouvre le même scanner**, qui lit le **QR du salarié** (dans son e-mail ou
  sur son téléphone) ou l'étiquette du colis. Sinon, saisie du **PIN** à 4-6 chiffres (pavé numérique
  plein écran) ou recherche du nom.
- Écran salarié : en-tête nom, service, avatar ; **tous ses colis en attente cochés par défaut**
  (miniature, transporteur, date). Pied fixe « 3 colis sélectionnés » et « Faire signer ».
- **Signature plein écran** (passage en paysage facultatif), nom imprimé sous la ligne, « Effacer »,
  « Valider ». Photo de remise facultative. Cas « remis à un collègue » : champ nom du mandataire.
- **Confirmation plein écran** (coche, « 3 colis remis à Prénom NOM, 14:32 ») avec retour automatique au
  scanner en 2 s.
- Historique horodaté visible dans le détail du colis (reçu, notifié, relancé, remis).

### Notifications (e-mail au salarié)
- Objet : « Un colis vous attend au service courrier ». Corps : **lieu précis de retrait** (bâtiment,
  étage, guichet, horaires), transporteur et expéditeur s'il est lu, **photo de l'étiquette**, note de
  l'agent, et **QR de retrait et PIN** en grand.
- Actions dans l'e-mail (modèle Envoy) : **« Ce n'est pas à moi »** et « Je passe plus tard ». « Je l'ai
  récupéré » n'est utile que sans remise contrôlée ; chez YSL, la remise est validée par l'agent, donc à
  éviter ou à remplacer par « Je passe aujourd'hui ».
- Plusieurs colis pour la même personne le même jour : un seul e-mail récapitulatif.
- **Relance automatique** (J+1 puis J+3), et passage en « En retard » côté agent.
- Ton bref et institutionnel, sans emoji : marque Saint Laurent, fond blanc, typographie de la maison,
  noir comme seul accent.

### Navigation et style (déduits des meilleures)
- **3 onglets suffisent** : *Scan* (central, par défaut à l'ouverture), *Colis* (liste, exceptions,
  compteurs), *Remise*. Réglages dans un menu. Pas de grille de tuiles façon BuildingLink.
- Fond blanc, gris très clair pour les groupes, **un seul accent : le noir**, cohérent avec YSL et avec
  le bouton noir de Parcel Tracker. Couleurs fonctionnelles réservées aux statuts (ambre à vérifier, rouge
  en retard, vert remis). Coins de 12 à 16 px, pilules pour les actions. Scan et signature en mode sombre.
- Cibles tactiles d'au moins 44 pt, actions principales dans la zone du pouce (bas de l'écran), aucun
  pop-up de notation, session longue (pas de déconnexion en plein scan).

---

## 7. Index des images (`mailroom/`)

| Fichier | Contenu |
|---|---|
| `envoy-scan-destinataire-introuvable.png` | Scan Envoy : feuille « No recipient found », bouton Add recipient, recherche avec Récents |
| `envoy-scan-en-serie-geste.jpg` | 6 images extraites du GIF d'aide : photo colis après colis |
| `envoy-dashboard-correction-destinataire.jpg` | Delivery log web, « Unidentified recipient » en orange, correction avec photo à côté |
| `envoy-notification-email-slack-teams.png` | Notification e-mail, Slack et Teams avec photo et 3 actions |
| `envoy-email-colis-sans-destinataire.png` | E-mail admin pour un colis sans destinataire |
| `parceltracker-scan-dernier-scanne-undo.jpg` | Scan : toast Last scanned et Undo, « New Parcel Added », étapes, bottom sheet destinataire |
| `parceltracker-accueil-compteurs.jpg` | Accueil : Synced, compteurs Held / Overdue / Dispatch, 5 onglets |
| `parceltracker-liste-colis-scannes.jpg` | Liste groupée par destinataire, miniatures, transporteur, chips |
| `parceltracker-remise-checkout.jpg` | Check Out : signature, notes, photo, « Complete Checkout » |
| `verkada-liste-en-attente.jpg` | Liste Waiting / Picked Up par jour, avatar et photo, FAB |
| `verkada-scan-viseur-rond.jpg` | Viseur rond annoté, Manual Entry |
| `verkada-verification-feuille.jpg` | Feuille de vérification par-dessus la caméra |
| `verkada-etiquette-et-sms.jpg` | Étiquette auto-imprimée et SMS au destinataire |
| `verkada-detail-colis-remise.jpg` | Détail colis et « Mark as Picked Up » |
| `packagex-scan-rafale-compteur.jpg` | Scan en rafale avec compteur de lot |
| `packagex-liste-items-tags.jpg` | Liste Inbound / Outbound, badges de statut |
| `packagex-signature-checkout.jpg` | Signature plein écran |
| `packagex-detail-item.jpg` | Détail item, Notify |
| `notifii-formulaire-log-in.jpg` | Formulaire de réception (contre-exemple) |
| `notifii-scan-code-barres.jpg` | Scan code-barres avec cadre rouge |
| `notifii-liste-selection-remise.jpg` | Liste à cocher pour la sortie |
| `notifii-remise-signature.jpg` | Sortie : statut, signature, notes, photo d'ID |
| `avigilon-scan-plein-ecran.jpg` | Scan photo plein écran |
| `avigilon-detail-historique.jpg` | Détail en liste iOS et historique horodaté |
| `avigilon-email-qr-retrait.jpg` | E-mail avec QR de retrait |
| `deliveryos-formulaire-scan.jpg` | Formulaire après scan (Retake / Submit) |
| `deliveryos-remise-multi-colis.jpg` | Remise de plusieurs colis cochés |
| `deliveryos-signature.jpg` | Signature avec nom imprimé |
| `deliveryos-confirmation.jpg` | « Scan Submitted » |
| `greetly-choix-destinataire.jpg` | Choix du destinataire avec ligne cochée verte |
| `greetly-recap-colis.jpg` | Cartes photo, Check out |
| `packagezen-scan-photo.jpg` | « Just snap a picture » |
| `packagezen-checkout-photo.jpg` | Sortie par photo |
| `sendsuite-scan-code-barres.jpg` | Scan code-barres avec consigne (contre-exemple) |
| `sendsuite-formulaire-reception.jpg` | Formulaire et clavier (contre-exemple) |

## 8. Sources

- App Store : [Parcel Tracker](https://apps.apple.com/app/id1491350064) ·
  [Verkada Mailroom](https://apps.apple.com/app/id1631622141) · [Envoy](https://apps.apple.com/app/id983102576) ·
  [PackageX Receive](https://apps.apple.com/app/id1615717057) · [Mailroom by PackageX](https://apps.apple.com/app/id1441409759) ·
  [Notifii Track](https://apps.apple.com/app/id872446898) · [Package Zen](https://apps.apple.com/app/id817890100) ·
  [Greetly](https://apps.apple.com/app/id1330288641) · [Avigilon Alta Mailroom](https://apps.apple.com/app/id6502196111) ·
  [DeliveryOS](https://apps.apple.com/app/id6747896606) · [GEO BuildingLink](https://apps.apple.com/app/id465966658) ·
  [SendSuite Tracking Online](https://apps.apple.com/app/id1165888985) · [Luxer One](https://apps.apple.com/app/id1440094075) ·
  [Parcel Pending Mobile](https://apps.apple.com/app/id1352095998) · [Smiota](https://apps.apple.com/app/id1215491050) ·
  [Package Concierge](https://apps.apple.com/app/id1096327341) · [Amazon Hub](https://apps.apple.com/app/id6744907508)
- Avis App Store : `https://itunes.apple.com/us/rss/customerreviews/id=<id>/sortBy=mostRecent/json`
- Envoy : https://help.envoy.com/how-to-record-deliveries/ · https://help.envoy.com/how-to-correct-unprocessed-deliveries/ ·
  https://envoy.com/products/deliveries/features
- PackageX : https://help.packagex.io/en/knowledge/scanning-in-packages · https://help.packagex.io/en/knowledge/scan-issues ·
  https://help.packagex.io/en/knowledge/how-to-scan-and-send-items · https://packagex.io/ppc/receive
- Parcel Tracker : https://parceltracker.com/ · https://www.parceltracker.com/features/scan-in-parcels ·
  https://support.parceltracker.com/en/articles/316785-batch-scan ·
  https://support.parceltracker.com/en/articles/165649-can-i-scan-and-log-multiple-parcels-and-notify-all-recipients-at-once ·
  https://support.parceltracker.com/en/articles/177894-how-to-enable-and-use-batch-collection
- Verkada : https://www.verkada.com/blog/introducing-verkada-mailroom/ · https://internationalsecurityjournal.com/?p=42873
- Avis tiers : https://www.g2.com/compare/envoy-workplace-vs-parcel-tracker-mailroom ·
  https://www.capterra.com/p/143721/Envoy/reviews/ · https://www.capterra.com/p/136495/Notifii/reviews/ ·
  https://www.getapp.com/industries-software/a/notifii-track/
