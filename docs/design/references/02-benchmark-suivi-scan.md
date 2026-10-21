# Benchmark design : apps de suivi de colis et apps pro de scan

> Courrier YSL : PWA iPhone du service courrier (Saint Laurent, Paris).
> Objectif : arrêter d'inventer les écrans et partir de ce qui marche dans les apps les mieux notées et les plus primées.
> Recherche faite le 21/10/2026. Les notes viennent de l'API iTunes Search/Lookup (App Store US, et FR quand elle existe).
> Les captures sont celles des fiches App Store (mzstatic) et de la documentation Scandit. Toutes sont dans `suivi-scan/`.

---

## 1. Tableau comparatif

### 1.1 Suivi de colis grand public (et Flighty comme référence de suivi de statut)

| App | Note US (nb avis) | Note FR (nb avis) | Ce qui est loué | Liste | Statut | Détail | Ajout / scan |
|---|---|---|---|---|---|---|---|
| **Parcel** (Ivan Pavlov) | 4,84 (22 777) | 4,78 (10 570) | Sobriété, iOS et Mac au même rendu, filtres actifs/terminés, widgets, extension de partage | Lignes simples, pas de cartes, séparateurs fins | Colonne gauche : compte à rebours « 1 day » orange **ou** icône (camion, chariot, coche) | Titre, n° de suivi orange, événements antichronologiques, carte | Feuille modale à 3 champs (Numéro / Transporteur / Description) |
| **Deliveries** (Junecloud) | 4,63 (34 336) | 4,57 (534) | Appli historique, import depuis les sites marchands, détection du presse-papiers | Bandeaux pleine largeur, une couleur choisie par livraison | Gros chiffre « 3 DAYS » ou rond coché (livré) | Carte en haut, tableau date / événement / lieu, « Show more » | Un champ unique qui accepte tout, plus « Scan a barcode » |
| **17TRACK** | 4,81 (21 058) | 4,88 (5 274) | Plus de 2 500 transporteurs, **ajout par lot**, détection auto du transporteur | Lignes avec puce de statut à droite, onglets avec compteurs | Puce icône + libellé (« Info Received », « Out for delivery ») | Phrase de statut, barre de progression, timeline verticale, logo du transporteur | Zone de texte numérotée « 3/10 » (collage en masse) |
| **Shop** (Shopify, ex-**Arrive**) | 4,80 (7,2 M) | 4,57 (46 841) | Suivi auto des commandes, ETA à l'heure près | Cartes par marchand, vignette produit | **Phrase d'ETA en gras** (« Arrives today, 3-4PM ») et barre de progression fine | Non montré | Automatique (e-mail ou compte marchand) |
| **Route** | 4,82 (519 964) | 4,60 (983) | Tout en un, notifications | Feuille sur carte « 4 packages », logo de la marque, barre de progression | Barre + « In Transit » + « Arrives Thursday » | Carte | Automatique |
| **Flighty** | 4,84 (158 038) | 4,78 (3 591) | **Apple Design Award 2023 (Interaction)**, finaliste App of the Year 2023, « almost boringly obvious » | Lignes denses façon tableau d'aéroport | Couleur sémantique sur les heures (vert à l'heure, orange tendu, rouge en retard), phrases naturelles | Bloc « Gate Departure in 1h42m », grandes heures, badge de porte jaune | Recherche, import auto |
| **La Poste – Colis & courrier** (inclut Colissimo) | 4,04 (123) | 4,43 (37 346) | Tout La Poste dans une appli, suivi Colissimo et lettres recommandées | Accueil en tuiles | **Stepper horizontal 5 points** + bulle de phrase | Logo transporteur, n°, « Nommer le suivi », dates prise en charge / livraison prévue, étapes en accordéon | Scan de document avec équerres bleues |
| **DHL Express** | 4,55 (18 691) | n/d | Suivi et expédition DHL | n/d | n/d | n/d | n/d |
| **UPS** (My Choice intégré) | 4,57 (1,2 M) | n/d | Contrôle de la livraison | n/d | n/d | n/d | n/d |
| **Packagetrackr** | introuvable sur l'App Store US | n/d | n/d | n/d | n/d | n/d | n/d |

> Note : Arrive (Shopify) a été renommée Shop en 2020. Packagetrackr ne sort plus dans la recherche App Store. Elle n'est pas analysée.

### 1.2 Apps pro de scan, logistique et livraison

| App | Note US (nb avis) | Ce qui est loué | Écran caméra | Feedback | Liste / compteur | Fin de flux |
|---|---|---|---|---|---|---|
| **Scandit Express** | 4,40 (5) | Modes Vitesse / Précision / Lot, OCR d'étiquettes, export CSV | Plein écran sombre. En bas : sélecteur de mode, « View List » avec **badge rouge compteur**, gros déclencheur blanc, « Done » | Coche turquoise sur chaque code lu (AR), toast vert « All items found successfully! » | Badge sur « View List » | « Done » |
| **Scandit SDK Showcase** (MatrixScan, SparkScan, ID, Label) | 4,29 (240) | Démos de référence du secteur | MatrixScan : coches vertes et **« ! » rouge** sur l'article fautif. SparkScan : **mini-aperçu en coin et gros bouton flottant** | Teinte plein écran (jaune doublon, rouge mauvais code), son, vibration | « 5 items scanned » + « CLEAR LIST » | Selon l'appli hôte |
| **Amazon Flex** | 4,70 (445 039) | Flux de tournée simple | Scan des colis au chargement | n/d | « Deliver 2 packages », colis listés par type (Box / Envelope) et par **4 derniers chiffres** | Gros CTA orange « Scan packages » |
| **Onfleet Driver** | 4,84 (5 128) | Preuve de livraison complète | Scan de code-barres comme pièce jointe | Pastilles verte / rouge succès / échec | Liste d'adresses par onglets Today / All / Unassigned | **« Complete with Success »** vert pleine largeur |
| **Spoke (ex-Circuit)** | 4,74 (10 789) | Optimisation de tournée | « Scan to receive stops » (QR dans un cadre) | Modale de succès : rond vert coché, « Route completed! » | « 3/12 » sur la carte d'arrêt | Deux gros boutons échec / livré |
| **Shopify POS** | 4,44 (7 471) | Encaissement et retrait en boutique | Scan intégré | n/d | Lignes de commande avec **pastilles** « Paid », « Fulfilled », « Ready for pickup » (bleu), « Unfulfilled » (jaune) | n/d |
| **Square POS** | 4,81 (606 511) | Simplicité de caisse | Scan d'articles | n/d | n/d | n/d |
| **Sortly** | 4,73 (9 539) / FR 4,60 (64) | Inventaire « simplified » | Caméra plein écran, code dans un rectangle blanc arrondi | n/d | Lignes avec vignette et puce rouge « 1 unit » | Détail avec actions Move / History / Export |
| **Genius Scan** | 4,89 (1,37 M) / FR 4,78 (175 561) | Détection des bords, PDF multipage, OCR | **Calque orange translucide** sur le document détecté, déclencheur rond, modes Photos / Scan / Files | Capture auto | Pages en vignettes | Export |
| **Apple Notes / VisionKit (Live Text)** | natif | Référence native | Rectangle jaune sur le document détecté, capture auto (bascule Auto / Manuel). `DataScannerViewController` : surlignage des éléments reconnus, libellés de guidage, toucher pour sélectionner, pincer pour zoomer | « Garder » / « Reprendre » après chaque capture, puis on revient à la caméra | Enchaînement de plusieurs scans, « Enregistrer » à la fin | « Enregistrer » |
| **Google Lens** (appli Google) | 4,64 (5,25 M) | Reconnaissance universelle | Point d'ancrage et surlignage des zones reconnues | Puces de résultats | n/d | n/d |
| **Microsoft Lens** | **retirée** (janv. à mars 2026) | Était une référence de scan de documents | n/d | n/d | n/d | Remplacée par OneDrive et Copilot |

---

## 2. Analyse détaillée des 4 meilleures références

### 2.1 Parcel, le meilleur modèle pour notre **liste** et notre **détail** (Deliveries en contrepoint)

Captures : `suivi-scan/parcel-liste.jpg`, `suivi-scan/parcel-detail.jpg`, `suivi-scan/parcel-ajout.jpg`.

**Liste (`parcel-liste.jpg`)**
- Grand titre iOS « Deliveries » en gras. En haut à gauche, deux icônes rondes discrètes (réglages, filtre). Pas de barre d'onglets.
- **Des lignes, pas des cartes.** Séparateurs fins, fond blanc, beaucoup d'air. Chaque ligne a trois niveaux :
  1. le nom donné au colis en gras noir (« Jacket », « Parcel from John ») ;
  2. le dernier événement en gris (« Depart USPS Sort Facility », « Out for delivery ») ;
  3. l'échéance en gris (« Delivery by: Tomorrow 13:00 »).
- **Colonne de statut à gauche, un seul accent orange.** On y voit soit le **nombre de jours restants** (gros « 1 » orange avec « day » en petit dessous), soit une **icône** : chariot pour « en livraison », camion pour « en transit », **rond coché** pour « livré », « signature obtenue ».
- En bas : la loupe à gauche (à portée du pouce) et un **bouton rond orange « + »** à droite.

**Détail (`parcel-detail.jpg`)**
- Le nom du colis en très grand. Le **numéro de suivi en orange et en chasse fixe**. Le transporteur (« USPS ») aligné à droite, en gris.
- Historique antichronologique. Chaque événement a trois lignes : date (petit, noir), lieu (majuscules grises), libellé (noir semi-gras). Les 3 derniers sont visibles, puis un lien orange « View Full History ».
- La carte vient en dessous, avec des pastilles camion orange et un trajet en pointillés. Elle est secondaire.

**Ajout (`parcel-ajout.jpg`)** : une feuille modale avec trois lignes de formulaire (Number / Carrier avec chevron / Description), un X à gauche et une coche orange à droite. Le transporteur est déduit, on ne fait que le corriger.

**Contrepoint Deliveries** (`suivi-scan/deliveries-liste.jpg`, `deliveries-liste-statuts.jpg`, `deliveries-detail.jpg`, `deliveries-ajout.jpg`)
- Même structure de ligne (compte à rebours « 3 DAYS » ou rond coché à gauche, puis emoji, titre et deux lignes d'état). Mais chaque ligne est un **bandeau de couleur choisi par l'utilisateur** (marron, violet, jaune…). C'est joli en grand public, mais **la couleur ne dit rien du statut** : à ne pas reprendre.
- Ce qui est bon à prendre :
  - le **champ de recherche en bas** avec le « + » rond à côté ;
  - le **menu contextuel par appui long** avec aperçu (Edit / Refresh / Archive / Delete en rouge / Share) ;
  - le détail en tableau (date | événement | lieu en petites majuscules à droite) avec « Refreshed a moment ago » et le n° de suivi en pied ;
  - les actions « Archive » et « View Online » en bas ;
  - l'ajout par **un seul champ qui accepte tout**, plus « Scan a barcode » et « Create a placeholder ».

**À retenir** : la ligne en trois niveaux avec un glyphe de statut à gauche est le standard le plus lisible du secteur (Parcel 4,84). Un seul accent de couleur suffit.

### 2.2 Flighty, la référence pour **présenter un statut** (ADA 2023 Interaction)

Captures : `suivi-scan/flighty-liste.jpg`, `suivi-scan/flighty-detail.jpg`, `suivi-scan/flighty-retard.jpg`, `suivi-scan/flighty-live-activity.jpg`, `suivi-scan/flighty-alertes.jpg`.

- **Principe annoncé par le fondateur, Ryan Jones** : l'app doit sembler « almost boringly obvious ». Elle reprend les conventions des panneaux d'aéroport : une ligne par vol, et la couleur interprète à la place de l'utilisateur.
- **Liste « My Flights » (`flighty-liste.jpg`)** : une feuille blanche à grands coins arrondis par-dessus un globe.
  - Chaque vol tient sur trois lignes : logo de la compagnie + n° en gris, « Tokyo **to** San Francisco » en gras, puis les deux heures précédées d'un **rond fléché coloré** (départ ↗, arrivée ↘).
  - À droite : « Landing in **3h 30m** » avec la durée en vert.
  - Colonne gauche : état court en majuscules (« IN AIR ») sous une icône.
  - Les alertes sont **intégrées dans la ligne** : « 55m at JFK » en orange et une puce « Tight » orange (correspondance serrée).
- **Détail (`flighty-detail.jpg`)** :
  - Un bandeau d'en-tête vert pâle en phrase : « Gate Departure in **1h 42m** ». Dessous, l'explication : « Inbound aircraft is in the air from New York, with enough time… ».
  - Heures en très grand (« 10:20 AM », « 6:50 PM ») colorées selon l'état, avec la **sous-ligne d'état** « On Time · Departs in 1h 42m » ou « 4m Early ». L'ancienne heure est barrée (« 6:54PM »).
  - La porte est dans un **badge jaune** (« ↗46C »), le terminal en petit dessous. Les actions (Share) sont en bas.
- **Retard (`flighty-retard.jpg`)** : puce rouge « RUNNING LATE », phrase causale « 35m delay predicted due to late arriving aircraft », petite timeline verticale avec « 35m Delay Predicted » et « 52m Late » en rouge.
- **Live Activity (`flighty-live-activity.jpg`)** : SFO 11:00AM ✈ 12:20PM JFK, puis « 1h 20m UNTIL GATE ARRIVAL », « Departs Gate in 45m » et la porte dans une pastille jaune « A10 ».
- **Notifications (`flighty-alertes.jpg`)** : des phrases humaines, pas des codes. Par exemple « Good morning! Your flight today is on time. » ou « Taxiing for 13m, for take off at 5:34PM. »
- **15 états contextuels** (guide de Blake Crosley, source tierce) : ce qui s'affiche dépend de la phase. Avant le vol : confirmation. Près du départ : porte et heure limite. En vol : temps restant. Après l'atterrissage : correspondance. Le même guide décrit les chiffres en chasse fixe et le compte à rebours comme élément le plus gros. Les codes couleur hexadécimaux qu'il donne ne sont pas officiels.
- **Critique connue** : un retard d'une minute s'affiche déjà en rouge (fil Hacker News). Il faut **des seuils** pour ne pas crier au loup.

**À retenir** :
1. le statut s'écrit en **phrase avec une durée** (« Notifié il y a 2 h ») et non avec un code ;
2. la couleur est **sémantique et réservée aux états** ;
3. on montre seulement ce qui compte **à ce stade du cycle de vie** ;
4. les anomalies sont signalées **dans la ligne** par une puce, sans écran supplémentaire.

### 2.3 Scandit (SparkScan, Express, MatrixScan, Label Capture), la référence du **scan en série**

Captures : `suivi-scan/scandit-express-batch.jpg`, `scandit-express-tap-to-select.jpg`, `scandit-express-find.jpg`, `scandit-matrixscan-batch.jpg`, `scandit-sparkscan-liste-sequence.jpg`, `scandit-sparkscan-etats-doublon-erreur.jpg`, `scandit-label-capture-ocr-etiquette.jpg`, `scandit-matrixscan-count-icones-statut.png`.

- **Scandit Express, mode Batch (`scandit-express-batch.jpg`)** :
  - caméra plein écran, en-tête noir minimal (« < Back ») ;
  - sur chaque étiquette reconnue, une **coche turquoise dans un rond**, posée sur le code-barres (réalité augmentée) ;
  - barre du bas sur fond noir : sélecteur texte « Speed · Accuracy · **Batch** » (le mode actif en blanc), puis « View List » à gauche avec un **badge rouge « 10 »**, un **gros déclencheur blanc** au centre et « Done » à droite.
- **Mode Accuracy (`scandit-express-tap-to-select.jpg`)** : une infobulle « Tap shutter to select » et un viseur arrondi avec un point central. Le code visé est **surligné en turquoise** avant validation. C'est le mode « viser pour sélectionner » quand plusieurs codes sont dans le champ, ce qui est le cas sur un bordereau.
- **Mode Find (`scandit-express-find.jpg`)** : une barre de progression en haut avec « 1/1 », un toast vert « ✓ All items found successfully! » et un bouton pause rond.
- **MatrixScan (`scandit-matrixscan-batch.jpg`)** : une pile de cartons. Chaque étiquette porte une coche, **une seule porte un « ! » rouge**. L'erreur se voit sans quitter la caméra. Une icône de liste avec pastille rouge est à gauche du déclencheur, « Finish » à droite.
- **SparkScan (`scandit-sparkscan-liste-sequence.jpg`)** : c'est le modèle le plus proche de notre besoin.
  - L'interface métier (la **liste**) reste à l'écran. La caméra n'est qu'un **mini-aperçu en haut à droite**, avec fermer, torche, zoom « 1x » et agrandir.
  - On déclenche avec un **gros bouton rond flottant**, semi-transparent et déplaçable, placé sous le pouce.
  - À chaque lecture : **flash turquoise plein écran**, l'article s'ajoute en tête de liste (vignette, code, symbologie) et le compteur « 5 items scanned » avance. « CLEAR LIST » passe en rouge.
  - Un **appui long sur le bouton** lance le scan continu.
- **États d'erreur SparkScan (`scandit-sparkscan-etats-doublon-erreur.jpg`)** :
  - **doublon** : tout l'écran se teinte en jaune, puce rouge « Duplicate code », code entouré d'orange ;
  - **mauvais code** : teinte rouge et puce « Wrong code » ;
  - **normal** : pas de teinte.
  - Chaque état a sa couleur et sa durée de pause. Sous 2 s, on continue sans toucher l'écran. Au-delà de 10 s, il faut relancer à la main. Avec une pause de 0, le scan reprend tout de suite après un refus.
- **Label Capture, OCR d'étiquette (`scandit-label-capture-ocr-etiquette.jpg`)** : c'est **exactement notre cas** (lire plusieurs champs sur une étiquette).
  - Cadre à équerres blanches et bouton « Pause » sous le cadre.
  - Sous la caméra, **les champs attendus sont affichés** (« Barcode », « Expiry Date ») avec le texte « Scanning » en attente.
  - Les champs se remplissent en direct. Une fois validés, ils passent sur **fond turquoise pâle**.
  - Un toast « **2 / 2 label fields captured.** » apparaît, puis deux boutons : « Clear All » (rouge, contour) et « ✓ Finish » (noir).
- **Icônes de statut MatrixScan Count (`scandit-matrixscan-count-icones-statut.png`)** : des ronds pleins de couleur avec un glyphe noir. Jaune pour « Expired », rouge avec une croix pour « Wrong item », contour rouge pour « Fragile », jaune pour « Low stock », turquoise pour « Quality inspection ». En mode liste attendue, une **barre de progression remplace le badge compteur**, et les codes absents de la liste sont marqués en rouge.

**À retenir** :
- la caméra ne doit **jamais** forcer une validation par colis ;
- chaque scan réussi se signale par un retour **visuel, sonore et haptique**, et la liste se remplit en direct ;
- doublons et erreurs ont chacun **une teinte et un libellé distincts**, sans boîte de dialogue bloquante ;
- pour l'OCR, on **montre les champs attendus et on les coche** au fur et à mesure.

### 2.4 Onfleet Driver, la référence de la **remise** (preuve de livraison), avec Amazon Flex et Spoke

Captures : `suivi-scan/onfleet-preuve-livraison.jpg`, `suivi-scan/onfleet-liste.jpg`, `suivi-scan/amazonflex-scan-packages.jpg`, `suivi-scan/spoke-scan.jpg`, `suivi-scan/spoke-succes.jpg`.

- **« Complete Task » chez Onfleet (`onfleet-preuve-livraison.jpg`)**, en thème sombre avec des sections à en-tête en petites majuscules grises :
  1. **RECIPIENT ADDRESS** : nom en gras et adresse ;
  2. **TASK COMPLETED** : deux choix, « ● Success… » (pastille verte et texte vert, coche bleue à droite si sélectionné) et « ● Failure… » (pastille rouge) ;
  3. **ATTACHMENTS** : quatre tuiles carrées, Photo (« 1 Attached » en vert), Barcode, **Signature** (aperçu du trait et nom du signataire en vert), Verify Age (« Age Verified ») ;
  4. une note libre ;
  5. un gros bouton **vert pleine largeur « Complete with Success »** en bas.
- **Liste Onfleet (`onfleet-liste.jpg`)** : segmenté « Today · All · Unassigned ». Chaque ligne a une pastille violette, l'adresse en gras, « ↑ Pick-Up / ↓ Drop-Off – Nom » et le créneau.
- **Amazon Flex (`amazonflex-scan-packages.jpg`)** : une feuille « Deliver 2 packages » sur la carte. On y voit l'adresse, le nom du destinataire, une étiquette de zone « GRY-123 » et les colis listés par type et par **4 derniers chiffres** (« (M) Box 2411 », « Envelope 2412 »). Le CTA orange pleine largeur est **« Scan packages »** : on scanne pour confirmer qu'on remet le bon colis.
- **Spoke** :
  - `spoke-scan.jpg` : la caméra en plein écran, sombre, avec la consigne « Scan to receive stops » et un cadre blanc à coins arrondis ;
  - `spoke-succes.jpg` : une modale centrée, un rond vert coché, « Route completed! », l'heure, puis un bandeau crème de récompense (« You saved 1.4 hours and 22 miles 🎉 »). Sur la carte d'arrêt, « 3/12 · Small · Bag » et **deux gros boutons icône** échec / livré.

**À retenir** : la remise est un **écran unique** qui contient qui, quels colis, la preuve (signature, photo ou scan) et un bouton vert final. On confirme en **scannant le colis remis**, puis un succès explicite avec l'heure s'affiche.

---

## 3. Patterns récurrents qui marchent

### 3.1 Scan en série
1. **La caméra reste ouverte**. On enchaîne les colis sans valider chaque scan : Scandit Batch et SparkScan, et Notes revient à la caméra après « Garder ».
2. **Un compteur toujours visible**, sous forme de badge sur l'accès à la liste (Scandit Express « View List 10 ») ou de texte « 5 items scanned » (SparkScan).
3. **Le dernier élément scanné est visible tout de suite**, en tête de liste et avec vignette (SparkScan). La liste est en surimpression ou sous la caméra, jamais dans un autre écran.
4. **Un gros déclencheur sous le pouce** : rond blanc centré (Express), ou bouton flottant déplaçable et semi-transparent (SparkScan). La capture auto s'ajoute quand la détection est fiable (Genius Scan, Notes).
5. **Une sortie explicite** : « Done » ou « Finish » à droite du déclencheur, et l'accès à la liste à gauche.
6. **Torche et zoom** accessibles d'un geste (mini-aperçu SparkScan, pincer pour zoomer dans VisionKit).

### 3.2 Présentation des statuts
1. **Un glyphe à gauche de la ligne** (Parcel, Deliveries, Flighty) : compte à rebours ou icône d'état, avec coche pour « terminé ».
2. **Une puce colorée avec libellé** (17TRACK, Shopify POS : « Paid », « Fulfilled », « Ready for pickup » bleu, « Unfulfilled » jaune).
3. **Une phrase d'état avec durée ou échéance** en gras (Shop « Arrives today, 3-4PM », Flighty « Landing in 3h 30m »).
4. **Une progression** : barre fine (Shop, Route, 17TRACK) ou stepper à points (La Poste, 5 points avec le point courant cerclé de jaune et une bulle de phrase dessous).
5. **Onglets ou filtres avec compteurs** (17TRACK « All(6) · In transit(3) · Delivered(3) »).

### 3.3 Liste
- Des lignes plutôt que des cartes pour les listes longues (Parcel, Flighty, Onfleet, Shopify POS). Les cartes restent réservées aux listes courtes très visuelles (Shop).
- Trois niveaux de texte : titre en gras, état en gris, échéance ou heure en gris.
- Recherche et « + » **en bas**, à portée du pouce (Parcel, Deliveries).
- Appui long pour le menu contextuel (Deliveries) et glissement pour les actions rapides (convention iOS).

### 3.4 Détail
- En haut : identité (nom), **n° de suivi en chasse fixe** avec copie, logo ou nom du transporteur (Parcel, 17TRACK, La Poste).
- Puis **le statut en phrase** et la progression (La Poste, 17TRACK, Flighty).
- Puis l'historique en **timeline verticale antichronologique**, tronquée avec « Voir tout » (Parcel « View Full History », Deliveries « Show more », La Poste en accordéon « Détails des étapes » avec dates en puces jaunes).
- Les actions en bas (Deliveries « Archive / View Online », Flighty « Share »).

### 3.5 Feedback
- **Succès de scan** : surlignage ou coche sur le code (Scandit, VisionKit), flash coloré, son et vibration. Scandit recommande une pause d'environ **150 ms** avant de refermer la caméra pour que l'utilisateur soit sûr d'avoir scanné le bon article.
- **Erreur** : teinte et puce distinctes, **doublon (jaune) différent d'erreur (rouge)**, avec reprise automatique si la pause dure moins de 2 s (SparkScan).
- **Fin de flux** : un écran ou une modale de succès avec l'heure (Spoke « Route completed! 2:35 PM »), un toast « All items found successfully! » (Scandit Find) ou « 2 / 2 label fields captured » (Label Capture).

---

## 4. Règles UX de scan (Scandit, Apple et autres)

Sources : documentation Scandit (Best Practices for Usability, SparkScan Advanced, MatrixScan Count), billet du directeur UX de Scandit (« Scanning at Scale »), WWDC22 « Capture machine-readable codes and text with VisionKit ».

1. **Un feedback évident sur trois canaux** : visuel, son et haptique. Les environnements sont bruyants et l'utilisateur ne regarde pas toujours l'écran.
2. **Une courte pause (environ 150 ms) entre le feedback et la fermeture** ou le passage au scan suivant, pour rassurer.
3. **Assombrir l'extérieur du viseur sans faire un trou de serrure** : une zone de scan trop étroite gêne. La zone de détection et le cadre affiché sont deux réglages indépendants.
4. **Montrer que la caméra est active et à quelle distance tenir le téléphone.** En série, guider vers la distance optimale.
5. **Quand plusieurs codes sont dans le champ** (un bordereau en a souvent plusieurs : tracking, référence, code postal), utiliser un mode de sélection (« viser pour sélectionner » ou « toucher pour sélectionner ») plutôt que réduire la zone.
6. **Scan continu seulement si la caméra allumée ne provoque pas de scans involontaires.** Sinon, mettre en pause et afficher une invite persistante pour reprendre (« Tap shutter to resume »).
7. **Une grande zone tactile ergonomique** pour déclencher, déplaçable et semi-transparente pour ne pas masquer l'interface.
8. **La caméra est une couche sur l'interface métier**, pas un écran à part (SparkScan) : l'app doit être « an unobtrusive, helpful assistant ».
9. **Des états d'erreur distincts par cause** (doublon, code refusé), chacun avec sa couleur, son message et sa durée de pause.
10. **VisionKit** : surlignage automatique des éléments reconnus, libellés de guidage, toucher pour sélectionner et faire la mise au point, pincer pour zoomer.
11. **Capture auto avec repli manuel** (Notes et Genius Scan : rectangle de détection coloré, bascule Auto / Manuel).
12. **Saisie manuelle toujours possible** (Amazon Flex : « Manually Enter Package ID » dans le menu ⚙).

---

## 5. Anti-patterns observés

- **Couleur décorative au lieu de sémantique** : les bandeaux de couleur libre de Deliveries. Chez nous, une couleur doit toujours vouloir dire un statut.
- **Rouge trop vite** : Flighty passe en rouge pour une minute de retard, ce qui lui est reproché. Il faut des seuils (par exemple orange après 48 h sans retrait, rouge seulement pour un problème réel).
- **Accueil en mosaïque de tuiles** (La Poste) : tout est au même niveau, rien n'est prioritaire. Notre accueil doit être la liste de travail.
- **Contenu marketing et découverte** (Shop, Route) : hors sujet pour un outil interne.
- **La carte au centre** (Parcel, Deliveries, Route, Flighty) : inutile pour du courrier interne, alors qu'elle prend la moitié de l'écran dans ces apps.
- **Valider chaque scan dans une modale**, ou refermer la caméra après chaque colis : à l'opposé du scan en série.
- **Un cadre de scan minuscule** qui oblige à viser au millimètre (le « trou de serrure » selon Scandit).
- **Masquer les numéros** (17TRACK affiche « 920019*****55737 ») : en interne, on veut au contraire les **4 derniers chiffres bien lisibles** pour rapprocher le colis physique (Amazon Flex).
- **Le jargon transporteur brut dans l'historique** (« Processed through USPS Sort Facility ») : il faut réécrire en phrases métier.
- **Des actions accessibles uniquement par glissement** : il faut toujours un équivalent visible (bouton ou menu).
- **Les icônes sans texte** pour les statuts : il faut toujours icône, libellé et couleur (accessibilité, daltonisme).

---

## 6. Recommandations concrètes pour Courrier YSL

Direction visuelle : la retenue Saint Laurent. Fond blanc, texte noir, typographie système (SF Pro), **chiffres et numéros de suivi en chasse fixe** (SF Mono), à la façon de Parcel et de Flighty. **Les couleurs sont réservées aux statuts** et il n'y a pas d'autre accent. Les logos transporteurs sont en petit, en niveaux de gris ou dans un carré monochrome, comme 17TRACK mais sans saturer.

**Jeu de statuts (5 maximum, toujours icône + libellé + couleur)**

| Statut | Glyphe | Couleur | Phrase type |
|---|---|---|---|
| Reçu | carton | gris | « Reçu à 9 h 12 » |
| Notifié | enveloppe ou cloche | bleu | « Notifié il y a 2 h » |
| En attente prolongée (après X h) | horloge | orange | « En attente depuis 3 jours » |
| Remis | rond coché | vert | « Remis à M. Durand, 14 h 32 » |
| Problème (illisible, destinataire inconnu, abîmé) | « ! » | rouge | « Destinataire introuvable » |

### 6.1 Scan en rafale
Modèles : SparkScan, Scandit Express Batch, Label Capture, Notes.
- **Caméra plein écran**, ouverte en continu. **Cadre à équerres** au format d'un bordereau (paysage, environ 3:2), large, avec l'extérieur légèrement assombri.
- **Capture auto** quand l'étiquette est stable et que le tracking est lu. Un **gros déclencheur blanc centré** sert de repli. Torche en haut à droite, fermer en haut à gauche.
- **Compteur en pilule en haut**, par exemple « 12 colis ».
- **Pendant la lecture** : sous le cadre, trois **champs attendus** (Tracking, Transporteur, Destinataire) qui se remplissent en direct, comme dans Label Capture. Chaque champ lu passe en coche, et un champ non trouvé reste en « ? » orange.
- **Au succès** : vibration, bip court, coche verte brève sur l'étiquette. Une **vignette s'envole vers le bas** : un bandeau montre le dernier colis (4 derniers chiffres en gros, logo du transporteur, nom du destinataire). Ce bandeau se glisse pour annuler.
- **Doublon** : teinte jaune et puce « Déjà scanné ». Le colis n'est pas ajouté et le scan reprend en moins de 2 s.
- **Illisible** : puce rouge « Étiquette illisible ». On propose « Rapprocher », ou « Saisir » qui ouvre un clavier numérique avec le transporteur déduit.
- **Barre du bas** : à gauche l'accès à la liste avec son badge, au centre le déclencheur, à droite **« Terminer (12) »**.
- Si plusieurs codes sont présents, **le tracking est surligné automatiquement**. Un toucher sur un autre code permet de corriger (mode « viser / toucher pour sélectionner »).

### 6.2 Vérification
Modèles : Label Capture (champs validés sur fond pâle), 17TRACK (lot numéroté), Parcel (feuille à 3 champs).
- La liste du lot en cours, triée **« à vérifier d'abord »**, avec un compteur en tête : « 12 colis, 2 à vérifier ».
- Une ligne par colis : **miniature de l'étiquette** (touchée, elle s'agrandit pour comparer), destinataire, transporteur et tracking en chasse fixe. **Les champs incertains sont soulignés en orange.**
- Toucher une ligne ouvre une **feuille à 3 champs** (Destinataire avec autocomplétion sur l'annuaire YSL, Transporteur avec chevron, Tracking). Une coche à droite valide.
- CTA pleine largeur noir en bas : **« Valider et notifier 12 destinataires »**. Il reste désactivé tant qu'il reste des « ? », avec le libellé « 2 colis à compléter ».
- Après envoi, un toast « 12 destinataires notifiés » et retour à la liste.

### 6.3 Liste des colis (accueil)
Modèles : Parcel (lignes), 17TRACK (onglets avec compteurs), Flighty (alerte dans la ligne).
- Grand titre « Colis ». **Filtres segmentés avec compteurs** : « À remettre (8) · Remis aujourd'hui (23) · Tous ».
- **Des lignes et non des cartes**, en trois niveaux :
  - en gras, le **destinataire** (et son service) ;
  - en gris, le **transporteur et les 4 derniers chiffres** du tracking ;
  - en gris, la **phrase d'état** (« Notifié il y a 2 h »).
- À gauche, le **glyphe de statut** coloré. À droite, l'heure d'arrivée. Une puce orange « 3 j » apparaît si l'attente est prolongée.
- Regroupement par destinataire quand il y en a plusieurs (« M. Durand, 3 colis »).
- **Barre de recherche en bas**, avec recherche par nom, service ou 4 chiffres. À côté, un **gros bouton rond « Scanner »**, l'action principale, sous le pouce.
- Gestes :
  - glisser vers la droite pour « Remettre » ;
  - glisser vers la gauche pour « Relancer » ;
  - appui long pour le menu complet ;
  - chaque action existe aussi dans le détail.
- **État vide** : « Aucun colis en attente », une illustration sobre et le bouton « Scanner des colis ».

### 6.4 Détail d'un colis avec historique
Modèles : Parcel (en-tête et historique), La Poste (stepper avec bulle), Flighty (phrase d'état).
- **En-tête** : le destinataire en grand titre, son service et son étage en gris. Puis le **tracking en chasse fixe** avec copie, et le transporteur à droite (logo monochrome et nom).
- **Statut** : un stepper à 3 points (**Reçu, Notifié, Remis**), le point courant cerclé. Dessous, une bulle avec la phrase d'état : « Notifié il y a 2 h, en attente de retrait ».
- **Photo de l'étiquette** cliquable, comme preuve et pour vérifier.
- **Historique** en timeline verticale antichronologique, avec des phrases métier : « Scanné par Karim, 9 h 12 », « Notification envoyée à j.durand@ysl.com, 9 h 15 », « Relance, 14 h 00 ». Les 3 derniers événements sont visibles, puis « Voir tout ».
- **Actions en bas** : « Remettre » (bouton noir pleine largeur) et, en secondaire, « Relancer » et « Signaler un problème ».

### 6.5 Remise
Modèles : Onfleet « Complete Task », Amazon Flex « Scan packages », Spoke (succès).
- **Un écran unique** :
  1. **DESTINATAIRE** : nom et service. Si le colis est retiré par un tiers, un champ « Remis à ».
  2. **COLIS** : la liste de ses colis en attente, cochés par défaut, chacun avec ses 4 derniers chiffres et son transporteur. Le bouton « Scanner pour confirmer » coche les colis à mesure qu'on les scanne, comme Amazon Flex.
  3. **PREUVE** : tuiles Signature (zone de signature plein écran, qui affiche ensuite un aperçu du trait et le nom en vert), Photo, Badge.
  4. CTA vert pleine largeur **« Remettre 3 colis »**.
- **Succès** : une modale ou un écran plein avec un rond vert coché, « 3 colis remis à J. Durand », l'heure, puis « Annuler » pendant quelques secondes et « Terminé ».
- **Échec ou refus** : un choix rouge « Non remis » avec un motif (absent, refus, mauvais destinataire). Le colis repasse en « Problème ».

---

## 7. Index des captures

| Fichier | Contenu |
|---|---|
| `suivi-scan/parcel-liste.jpg` | Parcel : liste en lignes, glyphe ou compte à rebours orange à gauche |
| `suivi-scan/parcel-detail.jpg` | Parcel : détail, tracking orange en chasse fixe, historique, carte |
| `suivi-scan/parcel-ajout.jpg` | Parcel : feuille d'ajout à 3 champs |
| `suivi-scan/deliveries-liste.jpg` | Deliveries : liste en bandeaux colorés, recherche en bas |
| `suivi-scan/deliveries-liste-statuts.jpg` | Deliveries : livrés (ronds cochés) et en transit (jours) |
| `suivi-scan/deliveries-detail.jpg` | Deliveries : détail avec tableau d'événements, Archive / View Online |
| `suivi-scan/deliveries-ajout.jpg` | Deliveries : champ unique, import, « Scan a barcode » |
| `suivi-scan/17track-liste.jpg` | 17TRACK : onglets avec compteurs, puces de statut, logos transporteurs |
| `suivi-scan/17track-ajout-lot.jpg` | 17TRACK : ajout par lot numéroté « 3/10 » |
| `suivi-scan/17track-detail.jpg` | 17TRACK : statut, barre de progression, timeline |
| `suivi-scan/shop-commandes.jpg` | Shop : cartes de commande, ETA en phrase et barre de progression |
| `suivi-scan/route-liste.jpg` | Route : liste en feuille, barres de progression |
| `suivi-scan/flighty-liste.jpg` | Flighty : « My Flights », lignes denses, puce « Tight » |
| `suivi-scan/flighty-detail.jpg` | Flighty : détail, bandeau d'état en phrase, grandes heures, badge de porte |
| `suivi-scan/flighty-retard.jpg` | Flighty : « RUNNING LATE », retard prédit avec cause |
| `suivi-scan/flighty-live-activity.jpg` | Flighty : Live Activities et Dynamic Island |
| `suivi-scan/flighty-alertes.jpg` | Flighty : notifications en phrases naturelles |
| `suivi-scan/laposte-suivi.jpg` | La Poste / Colissimo : stepper 5 points et bulle, étapes en accordéon |
| `suivi-scan/laposte-scan-document.jpg` | La Poste : cadre à équerres bleues pour scanner un document |
| `suivi-scan/scandit-express-batch.jpg` | Scandit Express : coches AR, badge compteur, déclencheur, Done |
| `suivi-scan/scandit-express-tap-to-select.jpg` | Scandit Express : viser ou toucher pour sélectionner parmi plusieurs codes |
| `suivi-scan/scandit-express-find.jpg` | Scandit Express : progression 1/1 et toast de succès |
| `suivi-scan/scandit-matrixscan-batch.jpg` | Scandit MatrixScan : coches et erreur « ! » rouge sur un carton |
| `suivi-scan/scandit-sparkscan-liste-sequence.jpg` | SparkScan : séquence avec mini-aperçu, flash et liste qui se remplit |
| `suivi-scan/scandit-sparkscan-etats-doublon-erreur.jpg` | SparkScan : états doublon (jaune), mauvais code (rouge), normal |
| `suivi-scan/scandit-label-capture-ocr-etiquette.jpg` | Scandit Label Capture : champs OCR qui se remplissent, « 2/2 captured » |
| `suivi-scan/scandit-matrixscan-count-icones-statut.png` | Scandit : icônes de statut (périmé, erroné, fragile…) |
| `suivi-scan/sortly-scan.jpg` | Sortly : caméra de scan |
| `suivi-scan/sortly-detail.jpg` | Sortly : détail d'article, actions Move / History / Export |
| `suivi-scan/onfleet-liste.jpg` | Onfleet : liste de tâches segmentée |
| `suivi-scan/onfleet-preuve-livraison.jpg` | Onfleet : preuve de livraison (succès / échec, photo, signature) |
| `suivi-scan/amazonflex-scan-packages.jpg` | Amazon Flex : colis par 4 derniers chiffres, CTA « Scan packages » |
| `suivi-scan/spoke-scan.jpg` | Spoke : caméra « Scan to receive stops » |
| `suivi-scan/spoke-succes.jpg` | Spoke : modale de succès « Route completed! » |
| `suivi-scan/geniusscan-capture.jpg` | Genius Scan : calque orange de détection auto du document |
| `suivi-scan/shopifypos-commandes.jpg` | Shopify POS : lignes de commande avec pastilles de statut |

---

## 8. Sources

**Fiches App Store** (notes relevées le 21/10/2026 via `itunes.apple.com/lookup` et `/search`) :
- Parcel : https://apps.apple.com/us/app/parcel-delivery-tracking/id375589283
- Deliveries : https://apps.apple.com/us/app/deliveries-a-package-tracker/id290986013
- 17TRACK : https://apps.apple.com/us/app/17track-package-tracker/id1004956012
- Shop : https://apps.apple.com/us/app/shop-track-pay-discover/id1223471316
- Route : https://apps.apple.com/us/app/route-package-tracker/id1449803898
- Flighty : https://apps.apple.com/us/app/flighty-live-flight-tracker/id1358823008
- La Poste : https://apps.apple.com/us/app/la-poste-colis-courrier/id431602927
- DHL Express : https://apps.apple.com/us/app/dhl-express-mobile-app/id1426463073
- UPS : https://apps.apple.com/us/app/ups/id336377331
- Scandit SDK Showcase : https://apps.apple.com/us/app/scandit-sdk-showcase/id453880584
- Scandit Express : https://apps.apple.com/us/app/scandit-express/id1613733334
- Sortly : https://apps.apple.com/us/app/sortly-inventory-simplified/id529353551
- Shopify POS : https://apps.apple.com/us/app/shopify-point-of-sale-pos/id686830644
- Square POS : https://apps.apple.com/us/app/square-point-of-sale-pos/id335393788
- Onfleet Driver : https://apps.apple.com/us/app/onfleet-driver/id1084013403
- Amazon Flex : https://apps.apple.com/us/app/amazon-flex/id1454725763
- Spoke : https://apps.apple.com/us/app/spoke-route-planner/id1198232244
- Genius Scan : https://apps.apple.com/us/app/scanner-app-genius-scan/id377672876
- Google : https://apps.apple.com/us/app/google/id284815942

**Scandit** :
- Scanning at Scale, UX insights : https://www.scandit.com/blog/scanning-at-scale-ux-insights/
- Best Practices for Usability (iOS) : https://docs.scandit.com/data-capture-sdk/ios/best-practices-for-usability.html (page passée en 404 depuis, contenu repris des résultats de recherche)
- Best Practices for Usability (Web) : https://docs.scandit.com/data-capture-sdk/web/best-practices-for-usability.html
- SparkScan, intro et advanced (captures workflow-example, error-duplicate, error-wrong) : https://docs.scandit.com/sdks/ios/sparkscan/intro/ et https://docs.scandit.com/sdks/ios/sparkscan/advanced/
- SparkScan advanced, Web (durées des erreurs, maintien pour scan continu) : https://docs.scandit.com/sdks/web/sparkscan/advanced/
- MatrixScan Count advanced (icônes de statut, liste attendue, barre de progression) : https://docs.scandit.com/sdks/ios/matrixscan-count/advanced/ et https://docs.scandit.com/sdks/android/matrixscan-count/advanced/
- Label Capture (GIF de validation) : https://docs.scandit.com/sdks/ios/label-capture/intro/
- Scandit Express : https://docs.scandit.com/7.6.5/hosted/express/overview/

**Apple et natif** :
- WWDC22, Capture machine-readable codes and text with VisionKit : https://developer.apple.com/videos/play/wwdc2022/10025/
- Scanning data with the camera (VisionKit) : https://developer.apple.com/documentation/visionkit/scanning-data-with-the-camera
- Scanner de Notes (rectangle jaune, Garder / Enregistrer) : https://www.devx.com/how-tos/how-to-scan-documents-on-iphone/ et https://macrumors.com/how-to/ios-11-document-scanner-notes

**Flighty** :
- Apple Design Awards 2023 : https://appleinsider.com/articles/23/05/23/apple-showcases-finalists-for-2023-design-awards et https://www.mactrast.com/?p=163695
- Behind the Design: Flighty : https://cur.at/VcCahLU?m=web
- Guide design de Blake Crosley (tiers) : https://blakecrosley.com/guides/design/flighty
- Critique du rouge pour une minute de retard (Hacker News) : https://hn.nuxt.dev/item/47511589

**Autres** :
- Parcel, revue : https://pcweenies.com/?p=12568
- Deliveries 7.0 (MacStories) : https://www.macstories.net/?p=41739
- Deliveries, passage à l'abonnement : https://mjtsai.com/blog/2020/10/15/deliveries-switches-to-subscription
- Onfleet, preuve de livraison : https://onfleet.com/proof-of-delivery
- Amazon Flex, retrait des colis : https://flex.amazon.com/blog/2024/navigating-the-package-pickup-process-with-ease
- Amazon Flex, retours (saisie manuelle de l'identifiant) : https://flex.amazon.com/blog/2025/navigating-the-package-returns-process-with-ease
- Retrait de Microsoft Lens : https://www.neowin.net/news/microsoft-lens-has-been-retired/ et https://techcrunch.com/2025/08/08/rip-microsoft-lens-a-simple-little-app-thats-getting-replaced-by-ai/
