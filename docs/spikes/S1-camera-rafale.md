# Spike S1 · caméra et rafale

Ticket YSL-6. Cahier des charges v2, §10.1 : vérifier sur iPhone, en PWA installée, qu'un
flux caméra unique tient la rafale. Prototype : [`apps/spike-camera`](../../apps/spike-camera).

| Critère      | Seuil                                                                                                     |
| ------------ | --------------------------------------------------------------------------------------------------------- |
| Rafale       | 50 captures sans plantage                                                                                 |
| Verrouillage | flux repris après verrouillage puis retour                                                                |
| Cadence      | ≤ 1 s entre deux captures                                                                                 |
| Sinon        | la photo native (`<input capture>`) devient le mode principal ; rafale par « photo + retour automatique » |

## Appareil

iPhone (D5 : iOS 26), PWA installée sur l'écran d'accueil, servie en HTTPS par
`tailscale serve`.

## Protocole

1. Sur l'iPhone, Tailscale connecté, ouvrir l'adresse du tailnet dans Safari, puis
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

À remplir après le passage sur l'iPhone.

## Verdict

À remplir.
