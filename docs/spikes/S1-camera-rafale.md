# Spike S1 · caméra et rafale

Ticket YSL-6. Cahier des charges v2, §10.1 : vérifier sur iPhone, en PWA installée, qu'un
flux caméra unique tient la rafale. Prototype : [`apps/spike-camera`](https://github.com/adbenmc-galadrim/Ysl/tree/6d15167a09ca8bc9052ab18a218e6b5d52af2a77/apps/spike-camera) (retiré, YSL-138).

| Critère      | Seuil                                                                                                     |
| ------------ | --------------------------------------------------------------------------------------------------------- |
| Rafale       | 50 captures sans plantage                                                                                 |
| Verrouillage | flux repris après verrouillage puis retour                                                                |
| Cadence      | ≤ 1 s entre deux captures                                                                                 |
| Sinon        | la photo native (`<input capture>`) devient le mode principal ; rafale par « photo + retour automatique » |

## Appareil

iPhone (D5 : iOS 26), PWA installée sur l'écran d'accueil depuis
`/spike-camera/`.

## Protocole

1. Sur l'iPhone, ouvrir `/spike-camera/` dans Safari, puis
   Partager › Sur l'écran d'accueil. Fermer Safari, lancer **Spike S1** depuis l'icône.
2. Journal : vérifier `standalone true`, noter `imageCapture` et `opfs`.
3. Capture › Démarrer la caméra, autoriser. Noter si iOS redemande l'autorisation aux
   lancements suivants.
4. **Rafale 50**, téléphone pointé sur une étiquette. Attendre la fin sans toucher l'écran.
5. Changer d'onglet Journal puis Capture : le viseur doit être vivant, sans « Démarrer ».
6. **Verrouiller** l'iPhone 10 s, déverrouiller : viseur vivant ? Une capture. Puis
   recommencer en verrouillant 2 min.
7. Passer sur une autre app 30 s (écran d'accueil, puis l'appareil photo d'iOS), revenir :
   viseur vivant ? Une capture.
8. **Rafale 50** une seconde fois (100 captures au total dans la session).
9. **Photo native** : une photo en portrait, une en paysage. **Importer** : 3 photos de la
   photothèque. Vérifier dans le journal l'orientation EXIF et que les vignettes sont
   droites.
10. Mémoire : pendant l'étape 8, iPhone branché au Mac, Safari › Développement › iPhone ›
    Spike S1 › Chronologies › Mémoire (la page n'expose pas le tas JavaScript sur Safari).
11. Journal › Terminer la session, puis Exporter le journal (AirDrop vers le Mac).

## Résultats

Passage du 23/10/2026, PWA installée, journal exporté (264 captures, une session de
3 h 12 dont 2 h 43 en arrière-plan). Safari 27.0.1 d'après l'agent utilisateur, qui fige
la version d'iOS (`iPhone OS 18_7`).

| Mesure              | Valeur                                                                                       |
| ------------------- | -------------------------------------------------------------------------------------------- |
| `standalone`        | `true`                                                                                       |
| `ImageCapture`      | présent ; `grabFrame` utilisé pour les 259 captures du viseur, aucun repli canvas            |
| OPFS                | présent ; 648 Mo écrits dans la session sans erreur                                          |
| Flux                | 3024×4032 à 30 i/s, un seul `getUserMedia` sur toute la session                              |
| Rafales             | 5 rafales complètes de 50 et 2 arrêtées à la main ; 0 échec, 0 plantage                      |
| Durée d'une capture | médiane 230 à 260 ms, max 320 ms (grab → JPEG → OPFS) hors rafale lente                      |
| Écart entre deux    | 700 à 703 ms (plancher de 700 ms imposé par le prototype) hors rafale lente                  |
| Rafale lente        | 1 sur 6 : médiane 947 ms, 24 écarts sur 50 au-delà de 1 s, max 1,70 s                        |
| JPEG                | 1,1 à 2,8 Mo en moyenne par rafale selon la scène ; 4032×3024 quand l'iPhone est en paysage  |
| Relances du flux    | 0                                                                                            |
| Mémoire             | dents de scie, retour au même niveau après chaque passage du ramasse-miettes, plateau stable |

**Arrière-plan et verrouillage.** À chaque sortie (verrouillage, autre app, retour à
l'écran d'accueil), la piste passe `muted` ; au retour elle repasse `unmuted` moins de
0,8 s après `page-visible`, sans relance de `getUserMedia`. Six sorties de 13 s à 2 h 43,
toutes reprises. Le viseur reste figé un instant avant de repartir.

**Autorisation.** iOS redemande l'accès à la caméra à chaque lancement de la PWA. Les deux
sessions « interrompues » du journal sont ces relances (`page-hide` journalisé avant la
fermeture), pas des plantages.

**Rafale lente.** La rafale de 11 h 59 coïncide avec un enregistrement de l'inspecteur Web
(pistes Captures d'écran, JavaScript et Processeur). Les cinq autres, dont une enregistrée
avec la seule piste Mémoire, tiennent 700 ms. Ralentissement dû à l'instrumentation, pas à iOS.

**Photo native et import.** Une photo native et 4 imports (3 JPEG, 1 capture d'écran PNG) :
orientation EXIF 6 lue sur les JPEG (brut 4032×3024), image redressée en 3024×4032 ; PNG
sans EXIF lu tel quel. Portrait et paysage vérifiés à l'œil, en natif comme dans le viseur.

**Mémoire.** Inspecteur Web, piste Mémoire, pendant une rafale : pas de montée continue,
pic affiché d'environ 370 Mo.

## Verdict

| Critère                 | Verdict | Preuve                                                       |
| ----------------------- | ------- | ------------------------------------------------------------ |
| 50 captures sans crash  | **go**  | 259 captures du viseur, 0 échec, 0 plantage                  |
| Reprise après sortie    | **go**  | 0 relance, piste `unmuted` en moins de 0,8 s, jusqu'à 2 h 43 |
| ≤ 1 s entre captures    | **go**  | 5 rafales sur 6 à 703 ms max ; capture seule ≈ 250 ms        |
| `grabFrame`             | **go**  | présent, pleine résolution 12 Mpx                            |
| Repli `<input capture>` | **go**  | photo et import lus, EXIF 6 redressée                        |
| Orientation EXIF        | **go**  | EXIF 6 redressée ; portrait et paysage droits                |
| Mémoire                 | **go**  | pas de fuite, pic ≈ 370 Mo                                   |

**Conséquence.** La rafale dans le viseur, sur un flux unique, est le mode principal de
capture. La photo native reste le repli (appareil sans caméra autorisée, import depuis la
photothèque). À reporter dans la suite :

- garder le flux ouvert toute la session : une relance de la PWA redemande l'autorisation ;
- afficher l'état figé du viseur au retour (moins d'une seconde) plutôt que de relancer ;
- la capture prend ≈ 250 ms : la cadence peut descendre sous 700 ms si le besoin s'en fait
  sentir, à mesurer avec le décodage (S2, S3).
