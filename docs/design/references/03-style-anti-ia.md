# 03 - Sortir du look « fait par IA » : diagnostic, références, 3 directions

> Courrier YSL : PWA iPhone du service courrier. Scan de colis, liste par statut, remise avec QR ou signature.
> Retour client sur les maquettes actuelles : « trop arrondies », « trop made by AI ».
>
> Recherche faite le 21/10/2026. Sources : articles et guides de designers, mesures faites directement dans
> le navigateur (styles calculés sur `teenage.engineering` et `nothing.tech`, iPhone 390 px), API Google Fonts
> pour vérifier que chaque police citée existe vraiment, et images de référence téléchargées dans `style/`.
>
> Choix de périmètre : les sites des maisons de luxe (dont la marque cliente) ne servent **pas** de
> référence. Le style vient d'outils utilitaires à forte identité : objets, signalétique, logistique.
>
> Avertissement sur les sources : la plupart des textes sur l'« AI slop » sont des billets de blog ou
> d'agences. Ils se recoupent bien, mais ce sont des avis, pas des mesures. Les chiffres cités viennent de
> mes propres relevés quand c'est indiqué.

---

## 0. En une phrase

Le problème n'est pas l'arrondi en soi : la calculatrice Braun ET66 a des touches rondes, et Teenage
Engineering met un bouton en pilule dans son bandeau cookies. Le problème, c'est **un seul rayon généreux
appliqué partout, sans raison**, avec le reste du kit par défaut (Inter, Lucide, pastilles teintées, cartes,
toasts flottants). On le corrige en **décidant** chaque forme, chaque couleur et chaque police, et en
empruntant le vocabulaire d'un métier réel, celui de l'étiquette, du quai et de l'instrument.

---

## 1. Ce qui fait qu'une interface « fait IA » en 2025-2026

### 1.1 Pourquoi tout se ressemble

- **La moyenne statistique.** Les modèles produisent la moyenne de ce qu'ils ont vu, et ce qu'ils ont vu,
  c'est surtout du React + Tailwind + shadcn/ui + Lucide.
  ([vp0.com](https://vp0.com/blogs/why-does-my-ai-app-look-generic),
  [askcodi](https://askcodi.substack.com/p/the-ai-ui-problem-nobody-talks-about),
  [925 Studios](https://www.925studios.co/blog/ai-slop-design-tells))
- **Le copier-coller de shadcn.** Les composants shadcn sont copiés dans chaque projet comme des fichiers.
  Le même bouton se retrouve donc mot pour mot dans des milliers de dépôts publics, et les outils (v0,
  Lovable, Bolt) sont réglés pour sortir exactement cette pile.
  ([dev.to](https://dev.to/lyd_lyd_d4869af25d33ce0eb/why-do-ai-generated-websites-all-look-the-same-k2j),
  [prg.sh](https://prg.sh/ramblings/Why-Your-AI-Keeps-Building-the-Same-Purple-Gradient-Website))
- **Le violet par défaut.** Le `bg-indigo-500` de Tailwind UI est souvent cité comme l'origine du « purple
  problem ». L'anecdote des excuses d'Adam Wathan n'est rapportée que de seconde main : je ne l'ai pas
  retrouvée dans une source primaire.
  ([925 Studios](https://www.925studios.co/blog/ai-slop-design-tells),
  [Medium](https://ai-engineering-trend.medium.com/the-mystery-behind-ais-purple-problem-revealed-0234afdb292e))
- **« Personne n'a décidé ».** Inter est une bonne police. C'est un Inter **non choisi** qui trahit que
  personne n'a pris la décision typographique. ([925 Studios](https://www.925studios.co/blog/ai-slop-design-tells))

### 1.2 Les marqueurs concrets

| Marqueur | Pourquoi ça « fait IA » | Source |
|---|---|---|
| **Même rayon généreux partout** (cartes, boutons, champs, images) | Aplatit la hiérarchie et rend tout interchangeable | [noqta](https://noqta.tn/en/blog/ai-design-slop-overused-ui-patterns-fix-2026), [impeccable](https://impeccable.style/slop), [Kosta Canatselis](https://world.hey.com/kostac/spot-the-slop-a-ui-designer-s-guide-to-fixing-ai-defaults-4c448c9c) (« identical padding, corner radius, and card heights ») |
| **Inter (ou Geist) par défaut**, une seule police, hiérarchie plate | La police « par défaut de tous les outils » | [impeccable](https://impeccable.style/slop), [925 Studios](https://www.925studios.co/blog/ai-slop-design-tells), skill `frontend-design` d'Anthropic ([miroir](https://www.skills.sh/openclaw/skills/anthropic-frontend-design)) |
| **Dégradés violet / indigo**, texte en dégradé, halo radial | « Le Times New Roman du design IA » | [Fountain Institute](https://www.thefountaininstitute.com/blog/signs-vibe-coded-ui), [impeccable](https://impeccable.style/slop) |
| **Cartes partout, cartes dans des cartes**, grille de 3 cartes identiques | Chaque bloc est encadré, au lieu de grouper par l'espace et la typo | [Fountain Institute](https://www.thefountaininstitute.com/blog/signs-vibe-coded-ui), [impeccable](https://impeccable.style/slop) |
| **Ombre douce grise identique** sous chaque carte (`rgba(0,0,0,.1)`), ou filet fin + ombre large | Deux bords pour une même surface | [impeccable](https://impeccable.style/slop), skill Anthropic |
| **Pastille d'icône** (carré ou rond teinté au-dessus ou à gauche d'un titre) | « Stock feature-card pattern » | [impeccable](https://impeccable.style/slop) (« Icon tile above a heading ») |
| **Icônes au trait fin génériques, Lucide** | Lucide est livré par défaut dans les templates, les kits et les composants générés. Un seul style, au trait, sans variante pleine | [Hugeicons](https://hugeicons.com/blog/design/8-lucide-icons-alternatives-that-offer-better-icons) (concurrent, donc intéressé), [925 Studios](https://www.925studios.co/blog/ai-slop-design-tells) |
| **Pilules partout** : badges « New / Live », chips, boutons | Une pilule a l'air cliquable et n'ajoute rien | [impeccable](https://impeccable.style/slop) (« Badge above the headline »), [noqta](https://noqta.tn/en/blog/ai-design-slop-overused-ui-patterns-fix-2026) |
| **Points de statut sans état réel**, point qui pulse | « De la décoration déguisée en donnée » | [Fountain Institute](https://www.thefountaininstitute.com/blog/signs-vibe-coded-ui), [noqta](https://noqta.tn/en/blog/ai-design-slop-overused-ui-patterns-fix-2026) |
| **Liseré coloré sur un côté d'une carte arrondie** | « La signature la plus reconnaissable de l'UI générée » | [noqta](https://noqta.tn/en/blog/ai-design-slop-overused-ui-patterns-fix-2026), [impeccable](https://impeccable.style/slop) |
| **Emoji comme icônes** | « L'interface n'a jamais eu à prendre de vraie décision » | [Fountain Institute](https://www.thefountaininstitute.com/blog/signs-vibe-coded-ui) |
| **Glassmorphism**, flou décoratif, néon sur fond sombre | Effet sans fonction | [impeccable](https://impeccable.style/slop), [Fountain Institute](https://www.thefountaininstitute.com/blog/signs-vibe-coded-ui) |
| **Espacements monotones** | On ne voit plus ce qui va ensemble | [impeccable](https://impeccable.style/slop) |
| **Animations génériques** : fondu-glissé à l'entrée, rebond, hover sur chaque carte | Le mouvement par défaut, qui ne dit rien | skill Anthropic, [impeccable](https://impeccable.style/slop) |
| **Textes génériques** : « Tout est remis ! », slogans, tirets cadratins partout | La voix « assistant » | [impeccable](https://impeccable.style/slop), [Kosta Canatselis](https://world.hey.com/kostac/spot-the-slop-a-ui-designer-s-guide-to-fixing-ai-defaults-4c448c9c) |
| **États oubliés** (vide, erreur, hors ligne) ou traités par un gros pictogramme dans un rond gris | La démo a toujours des données | [Kosta Canatselis](https://world.hey.com/kostac/spot-the-slop-a-ui-designer-s-guide-to-fixing-ai-defaults-4c448c9c) |

### 1.3 Attention aux clichés « anti-IA », qui sont devenus des clichés IA

C'est le piège principal : les recettes pour sortir du look shadcn sont déjà apprises par les modèles.
Le skill `frontend-design` d'Anthropic et le catalogue [impeccable.style](https://impeccable.style/slop)
listent eux-mêmes comme **nouveaux défauts générés** :

- fond **crème / beige** (~`#F4F1EA`) + grand titre en **serif italique** + accent terracotta ;
- **quasi-noir + un seul accent acide** (vert fluo, vermillon) ;
- mise en page « **broadsheet** » : filets fins, rayon 0, colonnes denses façon journal ;
- **mono en petites capitales espacées** au-dessus de chaque titre (eyebrow) ;
- numérotation **01 / 02 / 03** sans vraie séquence ;
- `→` ajouté à la fin des liens et des boutons, chaînes « A · B · C » ;
- **néo-brutalisme** : bordures noires épaisses, ombres noires décalées. Superdesign le voit déjà retomber
  depuis mars 2026 ([setproduct](https://setproduct.com/blog/retro-brutalist-ui-design-2026),
  [pixso](https://pixso.net/articles/neo-brutalism-design/)).

Le « style Linear » (sombre, dense, halo flou) est un autre cliché : Daryl Ginn parle de « Linear effect »
([LogRocket](https://blog.logrocket.com/ux-design/linear-design),
[Anthony Hobday](https://anthonyhobday.com/blog/20230119.html),
[buildmvpfast](https://www.buildmvpfast.com/blog/linear-aesthetic-tokens-density-keyboard-first-ux-2026)).

**Conséquence pour nous :** passer à un rayon de 0 et à une police mono ne suffit pas. Chaque choix doit
venir d'une **raison du métier** (une étiquette, un tableau d'affichage, une touche), pas d'une
« esthétique anti-IA ».

### 1.4 Ce que nos maquettes ont de ce kit

Relevé sur `pistes-v2/piste-1-retenue.png` et `maquettes/05-colis.png` :

| Dans nos maquettes | Marqueur |
|---|---|
| Boutons noirs en pilule (« Scanner », « Notifier », « Remettre le colis »), radius 26 | Pilules partout |
| Champ « Rechercher » en pilule grise à côté du bouton pilule | Pilules partout |
| Cercles teintés à 12 % avec icône Lucide devant chaque ligne (rouge, orange, bleu, gris) | Pastille d'icône teintée + Lucide |
| Boutons d'en-tête ronds gris (☰, ‹, ⋯) | Pastilles rondes |
| Encadré orange teinté arrondi « En attente depuis 3 jours » | Carte teintée « alerte » |
| Badge pilule vert « ✓ À jour », pilule « Hors ligne », chips de filtre en pilule | Badges pilules + points de statut |
| Coches rondes vertes et orange dans le scan, sélection multiple en ronds noirs | Coches rondes génériques |
| Toast noir arrondi « Nouvelle version disponible » | Toast flottant arrondi |
| État vide : pictogramme dans un rond gris + « Tout est remis » + bouton pilule | État vide type template |
| Stepper à ronds « Reçu · Notifié · Remis » | Stepper générique |
| Inter partout, en une seule famille | Police par défaut |
| Photo d'étiquette posée sur un aplat carton arrondi | Carte arrondie décorative |

Ce qui est **bon** et qu'il faut garder : l'ordre par action (À compléter, À notifier, En attente de
retrait), le dernier colis visible avec Annuler pendant le scan, le numéro de suivi en mono, les textes
concrets (« Nom lu sur l'étiquette : L. FONTAIN »), un seul bouton principal par écran. Le problème est
l'habillage, pas la structure.

---

## 2. Ce que font les produits à identité forte (outils, objets, signalétique)

### 2.1 Mesures et observations

| Référence | Ce que j'ai mesuré ou vu | Ce qu'on en retient |
|---|---|---|
| **Teenage Engineering** (site, mesuré le 21/10/2026, `style/teenage-engineering-op1-mobile.png`) | Polices propriétaires `te-20` / `te-40` uniquement. **582 éléments sur 590 à rayon 0**. Graisses 100 à 300. Boutons « buy now » en **minuscules, en simple texte**, sans fond. Une seule couleur de lien (`#0071BB`), sinon noir, blanc et gris. La seule pilule du site est le bandeau cookies, dans un triangle jaune d'avertissement | Rayon 0 **par défaut**, et des exceptions qui ont une raison. Des actions en texte, pas en boîtes. Le jaune réservé au signal. Pour un usage debout, on ne reprend pas les graisses fines. Le guide [blakecrosley.com](https://blakecrosley.com/fr/guides/design/teenage-engineering) affirme « mono partout, orange `#ff6600` » : ma mesure le contredit, ce guide n'est pas fiable |
| **Teenage Engineering OP-1** (appareil) | Chaque mode prend tout l'écran, sans barre de navigation persistante. Quatre paramètres visibles, liés à quatre molettes ([blakecrosley.com](https://blakecrosley.com/fr/guides/design/teenage-engineering)) | Un écran = un mode. Le scan prend tout l'écran, sans chrome |
| **Nothing** (site, mesuré le 21/10/2026, `style/nothing-tech-mobile.png`) | Texte en `NType82` (grotesque). **Ndot (points) sur 9 éléments seulement**, `LatteraMono` en capitales 11 px pour les libellés, `Geist Mono`. 245 éléments à rayon 0, boutons à **4 px** (8 px pour une modale). Noir `#040404`, gris `#595A5A`, blanc, aucune couleur de marque | La police signature est **rationnée**. Nothing OS 4.0 est passé à Geist pour le texte courant et garde le dot-matrix « là où il définit le caractère sans nuire à la lecture » ([Nothing Community](https://nothing.community/d/61774-nothing-os-evolution/2), [smartprix](https://us.smartprix.com/bytes/nothing-os-5-0-revealed-check-new-features-and-rollout-schedule/)) |
| **Braun ET66**, Dieter Rams et Dietrich Lubs, 1987 (`style/braun-et66.jpg`) | Touches **rondes**, mais un code fonctionnel : chiffres noirs, fonctions brunes, **une seule touche jaune, « = »**. Deux petits boutons vert et rouge pour marche / arrêt | La couleur est un code, pas une ambiance : **une couleur = une fonction**. L'arrondi est accepté parce qu'il vient du doigt ([Wikipedia](https://en.wikipedia.org/wiki/Dieter_Rams), [Dwell](https://dwell.com/photos/query/braun%20et66%20calculator)) |
| **Things 3** (App Store 4,82 / 28 020 notes, `style/things3-liste.jpg`) | Aucune carte autour des tâches : du texte sur fond blanc. Case **carrée** à coins légers pour une tâche (le rond est réservé aux projets). Couleur **seulement si elle signifie** quelque chose (drapeau « today » rouge, heures). Sections en titre gras + filet | Lignes sans cartes, la couleur seulement sur le sens, la forme de la case qui dit le type d'objet ([MacStories](https://www.macstories.net/reviews/things-3-beauty-and-delight-in-a-task-manager/)) |
| **Style suisse** (Müller-Brockmann) | Grille stricte, texte en fer à gauche, drapeau à droite, asymétrie, grotesque, peu de couleurs ([MasterClass](https://www.masterclass.com/articles/swiss-design), [designyourway](https://www.designyourway.net/blog/swiss-design/)) | Alignement à gauche sur une grille, la hiérarchie par la taille et la graisse, pas par des boîtes |
| **Tableau des départs** (Paris-Nord, `style/gare-du-nord-tableau.jpg`) | Une ligne = un train. Colonnes fixes : heure, destination, voie. Chiffres alignés, texte jaune ou blanc sur noir, en capitales. Aucune icône, aucune boîte | La liste de colis est un **tableau de départs** : colonnes stables, chiffres tabulaires, statut dans une colonne fixe |
| **Signalétique aéroport** (`style/signaletique-aeroport.jpg`) | Schiphol et Changi : **jaune pour le flux principal** (départs, arrivées), autre couleur pour le reste. Noir sur jaune pour le contraste ([uxdesign.cc sur Schiphol](https://uxdesign.cc/wayfinding-at-schiphol-some-design-considerations-behind-the-world-famous-vi-system-and-what-29842b368252), [Changi](https://www.changiairport.com/corporate/media-centre/changijourneys/the-changi-experience/science-signs.html)). Kinneir et Calvert : partir de « que dois-je lire à vitesse ? », **casse mixte** plus lisible que les capitales ([Port](https://www.port-magazine.com/?p=462), [madegooddesigns](https://madegooddesigns.com/wayfinding-design/)) | Un seul code couleur pour « ce qui est à faire maintenant ». Noms en casse mixte. La couleur toujours doublée d'un texte |
| **Étiquette transporteur** (DHL, `style/etiquette-dhl.jpg`) | Zones fixes séparées par des filets, numéro de suivi en gros, codes-barres, code de tri en très gros, un titre en gras. « Les polices, les épaisseurs de trait et les zones blanches sont des exigences fonctionnelles, pas des détails esthétiques » ([cleverence](https://www.cleverence.com/articles/business-blogs/shipping-labels-shipping-5832/), [racklify](https://racklify.com/encyclopedia/the-anatomy-of-a-shipping-label/)) | Un vocabulaire **propre au métier courrier** : zones encadrées par des filets, une info énorme (le « code de tri »), des chiffres en mono |
| **Applis d'entrepôt / terminaux Zebra** | Grandes cibles tactiles utilisables avec des gants, **contraste élevé pour des écrans sales**, une action principale par étape, la caméra prête pour le code suivant ([Microsoft Dynamics 365](https://learn.microsoft.com/en-us/dynamics365-release-plan/2021wave1/finance-operations/dynamics365-supply-chain-management/warehouse-management-mobile-application), [racklify](https://racklify.com/encyclopedia/designing-warehouse-software-user-interfaces-practical-guidance/), [ontego](https://ontego.de/en/about-us/blogs/sap-logistics-ux-mobile-scanner-usability)) | Boutons de 56 px de haut au minimum, contraste AAA sur le texte utile, pas de gestes fins obligatoires |
| **Flighty** (Apple Design Award 2023, Interaction) | Reprend « les conventions éprouvées de la signalétique d'aéroport », pour être « presque ennuyeusement évident » (Ryan Jones, Apple *Behind the Design*). Couleur sémantique sur les heures ([Wikipedia](https://en.wikipedia.org/wiki/Flighty), [Apple, via cur.at](https://cur.at/VcCahLU?m=web)) | La preuve qu'une appli iPhone primée peut s'inspirer de la signalétique et non de shadcn. Voir aussi `02-benchmark-suivi-scan.md` |

### 2.2 Ce qui revient chez tous

1. **Un rayon par défaut (souvent 0), puis des exceptions justifiées** : le doigt pour une touche, la
   sécurité pour un avertissement.
2. **Une couleur = une fonction** (le jaune de l'ET66, le jaune de Schiphol, l'unique bleu de lien de TE).
   Le reste est en noir, blanc et gris.
3. **Des filets et des zones, pas des cartes et des ombres** (étiquette, tableau, Things).
4. **Une police signature rationnée** (Ndot chez Nothing) et une police de lecture neutre.
5. **Des chiffres traités comme des chiffres** : mono ou tabulaires, gros, alignés.
6. **Un écran = un mode**, le reste de l'interface disparaît (OP-1, scan).
7. **Un texte de terrain** : le mot du métier, court, en casse mixte.

Contexte plateforme : avec iOS 26 (Liquid Glass), Apple pousse vers des contrôles en capsule et des
coins concentriques au matériel ([MacStories](https://www.macstories.net/stories/ios-and-ipados-26-the-macstories-review/4),
[PhoneArena](https://www.phonearena.com/news/what-exactly-is-iphone-liquid-glass_id174090)). Une PWA
n'utilise pas ces contrôles natifs. Copier la capsule iOS à la main donne justement notre look actuel. On
garde les conventions iOS (zones sûres, geste retour, cibles de 44 pt minimum) mais pas les formes.

---

## 3. Trois directions

Contraintes communes : usage debout, d'une main, vite, parfois avec des gants ou sous un éclairage de
local courrier. Cibles de 48 px minimum, **56 px pour l'action principale**. Contraste AA minimum,
AAA pour le texte utile. Un seul bouton principal par écran. Toutes les polices citées ont été vérifiées
sur Google Fonts le 21/10/2026 (licence OFL).

### Direction A : « Étiquette »

*Le service courrier parle la langue de l'étiquette. L'interface en reprend les zones, les filets et le
gros code.*

| Élément | Choix |
|---|---|
| Références | Étiquette transporteur, style suisse, case carrée de Things 3 |
| Rayons | **0 partout.** Une seule exception : 2 px sur le champ de recherche, pour qu'il ne se confonde pas avec un filet |
| Typo texte | **Archivo** (grotesque à largeurs variables : on utilise la largeur normale pour le texte et **Archivo Narrow** / largeur 75 pour les titres de section et les gros noms). Alternatives : **Schibsted Grotesk**, **Libre Franklin** |
| Typo chiffres | **IBM Plex Mono** (n° de suivi, heures, compteurs). Alternative : **JetBrains Mono** |
| Palette | Papier `#FFFFFF`, encre `#0A0A0A`, gris texte `#5C5C5C`, filet `#0A0A0A` (1 px) et `#D9D9D9` (séparateur léger), **signal unique jaune étiquette `#FFD000`** (seulement « à faire maintenant »), erreur `#C8102E` (seulement « bloqué ») |
| Boutons | Rectangles pleine largeur de 56 px, noir plein, texte blanc Archivo 17 px semi-gras, **casse mixte**. Action secondaire : même rectangle avec un filet noir de 1,5 px, fond blanc. Aucune icône dans les boutons, sauf le viseur du scan |
| Listes | Pas de cartes. Lignes séparées par un filet, sur une grille à deux colonnes : à gauche le nom (Archivo 17 px) et le service (gris 14 px), à droite **les 4 derniers chiffres du suivi en mono 20 px**, comme le code de tri d'une étiquette. Titre de section en Narrow 13 px semi-gras + compteur, sur un **filet noir de 2 px** |
| Statuts | **Étiquette rectangulaire**, sans rond ni teinte : « À compléter » en noir sur jaune `#FFD000`, « À notifier » en blanc sur noir, « Notifié » avec un contour noir de 1 px, « Remis » en simple texte gris. Le retard s'écrit en clair dans la ligne (« 3 j »), en gras |
| Icono | **Presque pas d'icônes.** Les actions sont des mots. S'il en faut : **Material Symbols Sharp** (angles vifs, graisse variable, Apache 2.0), graisse 500, réglée sur la graisse du texte. Pas de Lucide |
| Densité | Moyenne à forte : lignes de 64 px, 8 colis visibles sans défiler |
| Signature | **La fiche colis est une étiquette** : zones délimitées par des filets (Destinataire / Transporteur / Suivi / Historique), le nom du destinataire en Narrow 32 px comme un « SHIP TO », le numéro de suivi en mono avec un vrai code-barres rendu. Le compteur de lot pendant le scan s'affiche en mono 48 px dans une zone encadrée en haut à gauche |
| Risque | Glisser vers le cliché « broadsheet ». Garde-fou : filets **épais et peu nombreux** (zones d'étiquette), pas de filets fins partout, pas de numérotation 01/02, pas de serif |

### Direction B : « Quai »

*La liste est un tableau des départs, et le jaune sert de signalétique. Pensée pour être lue à 60 cm,
debout, d'un coup d'œil.*

| Élément | Choix |
|---|---|
| Références | Tableau des départs SNCF, signalétique Schiphol et Changi, Flighty, Kinneir et Calvert |
| Rayons | **2 px** sur les boutons et les étiquettes de statut, 0 sur les panneaux et les bandeaux |
| Typo texte | **Atkinson Hyperlegible Next** (dessinée pour la lisibilité, formes de lettres très distinctes). Alternatives : **Overpass** (dérivée du Highway Gothic des panneaux routiers américains), **Public Sans** |
| Typo chiffres | **B612 Mono** (dessinée pour Airbus, pour les écrans de cockpit lus sous stress). Alternatives : **Atkinson Hyperlegible Mono**, **Red Hat Mono** |
| Palette | Fond `#FFFFFF`, encre `#111111`, gris `#5F6368`, **bandeau noir `#111111`**, **jaune signalétique `#FFC800`** (flux principal : à traiter), vert quai `#00704A` (remis ou validé, seulement avec un texte), rouge `#D50000` (bloqué). Option : un mode « local sombre » noir et jaune, comme le tableau |
| Boutons | Rectangles de 2 px de rayon, 56 px de haut. Principal : **jaune `#FFC800`, texte noir** en Atkinson gras 18 px. Secondaire : noir, texte blanc. Les flèches servent seulement à indiquer une direction réelle (retour ←), jamais en décoration |
| Listes | **Tableau à colonnes fixes** : heure d'arrivée (mono, tabulaire) · destinataire (nom en gras + service) · colonne statut alignée à droite, sur une largeur fixe. Lignes de 72 px, séparateur gris 1 px. En-têtes de section en **bandeau noir pleine largeur**, texte blanc en casse mixte + compteur à droite, comme un panneau |
| Statuts | **La colonne de droite fait office de « remarques »** : texte en capitales mono 13 px, sans pastille. « À TRAITER » en noir sur fond jaune, « NOTIFIÉ 10:34 », « EN ATTENTE 3 J » (le chiffre en gras), « REMIS ». Une couleur n'apparaît jamais sans son texte |
| Icono | **Pictogrammes de signalétique** : pleins, géométriques, peu nombreux (colis, e-mail, signature, alerte). Base **Material Symbols Sharp, en plein**, ou pictos AIGA/DOT (domaine public) redessinés. Aucun picto devant les lignes de liste |
| Densité | Forte, lisible : 7 à 8 lignes, chiffres de 17 à 20 px |
| Signature | **Le bandeau jaune « À traiter »** en haut de la liste : il dit combien de colis attendent une action et sert de bouton d'entrée. Pendant le scan, le dernier colis lu s'affiche dans un **panneau noir façon afficheur** (nom en blanc, 4 derniers chiffres en B612 Mono jaune) |
| Risque | Effet « kiosque d'aéroport » si le jaune est partout. Garde-fou : le jaune seulement pour « à faire maintenant » ; un écran sans action en attente ne contient pas de jaune |

### Direction C : « Instrument »

*L'appli est un appareil de mesure : coque gris clair, touches franches, une seule touche de couleur
(le « = » de l'ET66), un afficheur pour le compteur.*

| Élément | Choix |
|---|---|
| Références | Braun ET66 (Rams et Lubs), Teenage Engineering (OP-1 et site), Nothing (Ndot rationné) |
| Rayons | **4 px sur les touches** (le seul arrondi, celui du doigt, comme Nothing), 0 sur les zones, les listes et les panneaux. Cases à cocher carrées à 2 px |
| Typo texte | **Hanken Grotesk** (grotesque neutre, chaleur discrète, graisses de 100 à 900 ; on reste entre 450 et 700, jamais en fin). Alternatives : **Familjen Grotesk**, **Instrument Sans** |
| Typo libellés et chiffres | **Fragment Mono** pour les libellés de champs (11-12 px, capitales, **seulement comme sérigraphie de champ**, pas en eyebrow au-dessus des titres) et les chiffres. Alternative : **Martian Mono** |
| Typo afficheur | **Doto** (dot-matrix, Google Fonts), **uniquement** pour le compteur de lot du scan et le code de retrait à 4 chiffres. C'est la règle de Nothing : la police signature ne sert qu'aux chiffres « d'afficheur » |
| Palette | Coque `#E9EAEC` (gris aluminium **froid**, pas crème), surface `#FFFFFF`, encre `#121212`, gris `#6A6D70`, filet `#C9CBCE`, **une seule touche couleur : orange signal `#FF5A1F`**, réservée à l'action principale de l'écran (Scanner, Remettre). Erreur : texte `#B00020` avec la mention écrite |
| Boutons | **Touches** : 56 px, 4 px de rayon, fond blanc, filet de 1 px `#C9CBCE` et un trait inférieur de 2 px un ton plus sombre (relief physique, sans ombre portée floue). La touche principale est orange, texte noir. Groupes d'actions sur une **grille de touches à gouttière de 1 px** (comme les tableaux de spécifications de TE) |
| Listes | Panneau blanc posé sur la coque grise, pleine largeur, sans rayon. Lignes à filet de 1 px. À gauche une **case carrée** (sélection ou remise), au centre nom et service, à droite l'âge en mono (« 2 h », « 3 j ») |
| Statuts | **Voyants carrés** de 8 px (■ plein, □ vide, ◧ demi), **toujours suivis du mot** : « ■ À notifier », « ◧ Notifié », « □ Remis ». Le voyant ne pulse jamais. Le retard passe le texte en orange, sans fond teinté |
| Icono | **Pixelarticons** (MIT, grille de 24 px, en pixels) pour s'accorder avec l'afficheur, ou **Material Symbols Sharp** si on préfère une icône neutre. Peu d'icônes, et seulement sur les touches |
| Densité | Moyenne : lignes de 64 px, beaucoup de gris de coque autour des panneaux |
| Signature | **L'afficheur** : pendant le scan, en haut, une bande noire avec le compteur en Doto vert pâle `#C8FF9E` ou blanc, et le dernier nom lu en mono. À la remise, le code de retrait s'affiche en Doto 64 px. Hors de ces deux moments, Doto n'apparaît nulle part |
| Risque | Effet gadget ou rétro si Doto et les pixels débordent. Garde-fou : Doto sur deux écrans maximum, et le texte courant reste en grotesque à graisse normale |

### 3.1 Tableau de synthèse

| | A. Étiquette | B. Quai | C. Instrument |
|---|---|---|---|
| Rayon | 0 (2 px sur la recherche) | 2 px sur les contrôles, 0 sur les zones | 4 px sur les touches, 0 ailleurs |
| Texte | Archivo + Archivo Narrow | Atkinson Hyperlegible Next | Hanken Grotesk |
| Chiffres | IBM Plex Mono | B612 Mono | Fragment Mono + Doto (afficheur) |
| Couleur d'action | Noir (jaune = à faire) | Jaune `#FFC800` | Orange `#FF5A1F` |
| Statut | Étiquette rectangle inversée | Colonne « remarques » en mono | Voyant carré + mot |
| Icônes | Quasi aucune (mots) | Pictos de signalétique pleins | Pixelarticons ou Sharp, sur touches |
| Force | La plus « métier courrier », la plus sobre | La plus lisible debout et de loin | La plus singulière, la plus tactile |
| Risque | Cliché broadsheet | Effet kiosque | Effet gadget |

Recommandation : **A ou B pour un outil de terrain**. A si le client veut de la sobriété, B si la vitesse
de lecture prime. C est la plus mémorable, mais elle demande plus de discipline.

### 3.2 Ce qu'il faut ABANDONNER dans les maquettes actuelles (quelle que soit la direction)

1. Les **boutons en pilule** (radius 26) et le champ de recherche en pilule.
2. Les **pastilles rondes teintées à 12 %** avec une icône devant chaque ligne.
3. **Lucide**, et toute icône décorative devant un titre ou une ligne.
4. Les **boutons d'en-tête ronds gris** (☰, ‹, ⋯) : on passe à du texte (« Retour », « Menu ») ou à une icône nue de 44 px.
5. Les **badges pilules** « ✓ À jour » / « Hors ligne » et les **chips de filtre en pilule** : on passe à un contrôle segmenté rectangulaire ou à des onglets soulignés.
6. Les **encadrés d'alerte teintés et arrondis** (« En attente depuis 3 jours » sur fond orange pâle) : le fait passe dans la ligne, en gras.
7. Les **coches rondes vertes et orange** du scan et de la sélection : cases carrées, ou mot « Lu » / « À vérifier ».
8. Le **toast flottant arrondi** : remplacé par une barre pleine largeur collée en bas, à angles droits, qui pousse le contenu.
9. L'**état vide avec pictogramme dans un rond gris** : une phrase factuelle (« 0 colis en attente. Dernier remis à 16 h 12. ») et le bouton Scanner.
10. Le **stepper à ronds** Reçu · Notifié · Remis : une ligne de trois cases (ou trois colonnes datées) dont la case courante est pleine.
11. **Inter** utilisé seul : remplacé par la paire de la direction choisie.
12. L'**aplat carton arrondi** derrière la photo d'étiquette : photo à angles droits, filet de 1 px.
13. Les **gris pâles de remplissage** (`#F2F2F7`) comme fond de contrôles : un contrôle a un filet ou un plein, pas un fond gris doux.

---

## 4. Check-list anti-IA (à passer sur chaque écran)

1. **Rayons** : un rayon par défaut (0, 2 ou 4 px selon la direction). Toute exception est notée avec sa raison. Aucun rayon au-dessus de 4 px.
2. **Zéro pilule** : ni bouton, ni badge, ni chip, ni champ.
3. **Une seule couleur d'action** à l'écran, et une couleur n'apparaît jamais sans le mot qu'elle code.
4. **Pas de fond teinté** derrière une icône ou une alerte : le sens passe par le texte, la graisse ou un plein franc.
5. **Pas de carte par défaut** : on groupe par filets, alignements et titres. Une boîte seulement pour un objet isolable (l'étiquette, le QR).
6. **Pas d'ombre floue** : séparation par filet ou changement de fond franc.
7. **Deux familles de polices maximum**, dont aucune n'est Inter, Roboto ou Geist par défaut. Chiffres en mono ou tabulaires.
8. **Icônes seulement si un mot ne suffit pas.** Jamais devant chaque ligne. Jamais Lucide, jamais d'emoji.
9. **Texte en casse mixte** pour les noms et les actions. Capitales seulement pour les codes et les libellés de champs, pas d'eyebrow au-dessus des titres.
10. **Pas de clichés anti-IA** : ni crème, ni serif italique, ni 01/02/03, ni `→` décoratif, ni ombres noires décalées, ni filets fins partout.
11. **Une seule action principale**, de 56 px, en bas, atteignable au pouce. Cibles secondaires de 48 px minimum.
12. **Contraste** : texte utile à 7:1, rien en dessous de 4,5:1. Test à 60 cm, téléphone tenu à bout de bras, luminosité à 50 %.
13. **Mouvement utile seulement** : pas de fondu à l'entrée, pas de rebond, pas de pulsation. Transition de 100 à 150 ms quand un état change.
14. **Texte de terrain** : des faits (« Notifié lundi 10 h 34 »), pas d'exclamations ni de slogans (« Tout est remis ! »). Pas de tiret cadratin.
15. **Test du logo masqué** : on cache le nom de l'appli. Si l'écran pourrait appartenir à n'importe quel SaaS, on recommence.

---

## 5. Images de référence (`style/`)

| Fichier | Contenu | Source |
|---|---|---|
| `teenage-engineering-op1-mobile.png` | teenage.engineering, page OP-1 field, iPhone 390 px (capture du 21/10/2026) | https://teenage.engineering/products/op-1 |
| `nothing-tech-mobile.png` | nothing.tech, modale de pays : mono en capitales, Ndot pour le titre, bouton à 8 px | https://nothing.tech/ |
| `things3-liste.jpg` | Things 3, liste « Today » (visuel App Store) | https://apps.apple.com/app/id904237743 |
| `braun-et66.jpg` | Braun ET66 (1987) : touches codées par couleur, « = » jaune | Wikimedia Commons, « 1987 Braun calculator ET66 by Dieter Rams » |
| `gare-du-nord-tableau.jpg` | Tableau à palettes de Paris-Nord | Wikimedia Commons, « Gare du Nord Fallblattanzeiger Departure-board » |
| `signaletique-aeroport.jpg` | Signalétique jaune et noir en aéroport (Newark) | Wikimedia Commons, « Newark Airport Wayfinding Signage » |
| `etiquette-dhl.jpg` | Étiquette DHL Paket : zones, codes-barres, code postal écrit en gros | Wikimedia Commons, « Paketaufkleber DHL - Produktionsbasierte Abrechnung 2015 » |

## 6. Sources

Marqueurs « IA » :
- https://www.thefountaininstitute.com/blog/signs-vibe-coded-ui
- https://impeccable.style/slop
- https://world.hey.com/kostac/spot-the-slop-a-ui-designer-s-guide-to-fixing-ai-defaults-4c448c9c
- https://www.925studios.co/blog/ai-slop-design-tells
- https://noqta.tn/en/blog/ai-design-slop-overused-ui-patterns-fix-2026
- https://vp0.com/blogs/why-does-my-ai-app-look-generic
- https://askcodi.substack.com/p/the-ai-ui-problem-nobody-talks-about
- https://dev.to/lyd_lyd_d4869af25d33ce0eb/why-do-ai-generated-websites-all-look-the-same-k2j
- https://prg.sh/ramblings/Why-Your-AI-Keeps-Building-the-Same-Purple-Gradient-Website
- https://ai-engineering-trend.medium.com/the-mystery-behind-ais-purple-problem-revealed-0234afdb292e
- https://hugeicons.com/blog/design/8-lucide-icons-alternatives-that-offer-better-icons
- Skill `frontend-design` d'Anthropic (plugin Claude Code) : https://www.skills.sh/openclaw/skills/anthropic-frontend-design
- https://blog.logrocket.com/ux-design/linear-design
- https://anthonyhobday.com/blog/20230119.html
- https://www.buildmvpfast.com/blog/linear-aesthetic-tokens-density-keyboard-first-ux-2026
- https://setproduct.com/blog/retro-brutalist-ui-design-2026
- https://pixso.net/articles/neo-brutalism-design/

Références :
- https://blakecrosley.com/fr/guides/design/teenage-engineering (fiabilité partielle, contredit par ma mesure)
- https://nothing.community/d/61774-nothing-os-evolution/2
- https://us.smartprix.com/bytes/nothing-os-5-0-revealed-check-new-features-and-rollout-schedule/
- https://en.wikipedia.org/wiki/Dieter_Rams
- https://www.macstories.net/reviews/things-3-beauty-and-delight-in-a-task-manager/
- https://www.masterclass.com/articles/swiss-design
- https://uxdesign.cc/wayfinding-at-schiphol-some-design-considerations-behind-the-world-famous-vi-system-and-what-29842b368252
- https://www.changiairport.com/corporate/media-centre/changijourneys/the-changi-experience/science-signs.html
- https://www.port-magazine.com/?p=462
- https://madegooddesigns.com/wayfinding-design/
- https://racklify.com/encyclopedia/the-anatomy-of-a-shipping-label/
- https://www.cleverence.com/articles/business-blogs/shipping-labels-shipping-5832/
- https://learn.microsoft.com/en-us/dynamics365-release-plan/2021wave1/finance-operations/dynamics365-supply-chain-management/warehouse-management-mobile-application
- https://racklify.com/encyclopedia/designing-warehouse-software-user-interfaces-practical-guidance/
- https://ontego.de/en/about-us/blogs/sap-logistics-ux-mobile-scanner-usability
- https://en.wikipedia.org/wiki/Flighty
- https://cur.at/VcCahLU?m=web (Apple, *Behind the Design: Flighty*)
- https://www.macstories.net/stories/ios-and-ipados-26-the-macstories-review/4
- https://www.phonearena.com/news/what-exactly-is-iphone-liquid-glass_id174090
- Polices : métadonnées Google Fonts, https://fonts.google.com/metadata/fonts (Archivo, Archivo Narrow, Schibsted Grotesk, Libre Franklin, IBM Plex Mono, JetBrains Mono, Atkinson Hyperlegible Next et Mono, Overpass, Public Sans, B612 Mono, Red Hat Mono, Hanken Grotesk, Familjen Grotesk, Instrument Sans, Fragment Mono, Martian Mono, Doto : toutes présentes au 21/10/2026)
