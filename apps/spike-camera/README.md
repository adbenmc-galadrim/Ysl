# Spike S1 · caméra et rafale

Prototype jetable du spike S1 (cahier des charges v2, §10.1) : un flux caméra unique dans une
PWA installée sur iPhone, 50 captures d'affilée, reprise après verrouillage, repli photo
native et orientation EXIF. Le protocole et les résultats sont dans
[`docs/spikes/S1-camera-rafale.md`](../../docs/spikes/S1-camera-rafale.md).

À supprimer d'un bloc quand le mode rafale de l'app (YSL-23) est livré.

## Lancer

```sh
pnpm --filter @repo/spike-camera build
pnpm --filter @repo/spike-camera preview   # http://127.0.0.1:3102
pnpm --filter @repo/spike-camera tailnet   # https://<mac>.<tailnet>.ts.net
```

`getUserMedia` et l'installation PWA exigent HTTPS : l'iPhone passe par `tailscale serve`
(Tailscale démarré sur le Mac, app Tailscale sur l'iPhone, même compte, HTTPS activé sur le
tailnet). Arrêter le partage : `tailscale serve --https=443 off`.

## Ce que fait l'app

- **Capture** : un seul `getUserMedia`, jamais recréé tant que la piste vit ; au retour au
  premier plan, la vidéo reprend, et le flux n'est rouvert que si la piste est terminée
  (`stream-restarted` dans le journal).
- Image par `ImageCapture.grabFrame()`, sinon `createImageBitmap(video)` ; JPEG 0,9 borné à
  16 Mpx, écrit aussitôt dans OPFS par un worker ; seules 12 vignettes de 200 px restent
  en mémoire.
- **Rafale 50** : 50 captures enchaînées sans pause, l'écart entre deux captures mesure le
  débit réel.
- **Photo native** (`<input capture>`) et **Importer** (photothèque, plusieurs) : orientation
  EXIF lue avant décodage, image redressée par `createImageBitmap`.
- **Journal** : chaque capture et chaque événement du flux, conservé dans `localStorage` ;
  une session non terminée est signalée au lancement suivant (plantage, rechargement ou app
  tuée). « Exporter le journal » partage un JSON sans aucune image.
