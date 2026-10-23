# Spike S5 · e-mail via la messagerie du téléphone

Prototype jetable du spike S5 (YSL-8, D2 révisée) : ouvrir Mail, Outlook ou Gmail sur
l'iPhone avec un e-mail prérempli, mesurer ce qui arrive (accents, longueur, liens, HTML,
QR) et essayer des modèles gérés par l'utilisateur. Le protocole et les résultats sont dans
[`docs/spikes/S5-email-messagerie.md`](../../docs/spikes/S5-email-messagerie.md).

À supprimer quand le gabarit d'e-mail de l'app (YSL-66) est livré.

## Lancer

En production : https://ysl.shinseo.fr/spike-email/. L'image de `apps/web` construit le
spike et nginx le sert sous `/spike-email/` (`apps/web/Dockerfile`, `apps/web/nginx.conf`).

En local :

```sh
pnpm --filter @repo/spike-email build
pnpm --filter @repo/spike-email preview   # http://127.0.0.1:3104/spike-email/
pnpm --filter @repo/spike-email tailnet   # https://<mac>.<tailnet>.ts.net/spike-email/
```

L'installation PWA et la feuille de partage avec fichier exigent HTTPS : depuis le Mac,
l'iPhone passe par `tailscale serve`. Arrêter le partage : `tailscale serve --https=443 off`.

Le spike partage l'origine de l'app : ses données sont dans les clés `localStorage`
`spike-email:draft`, `spike-email:templates` et `spike-email:journal`.

Pour le retirer : supprimer `apps/spike-email` ; dans `apps/web/Dockerfile`, retirer
`--filter @repo/spike-email...` de l'installation, `&& pnpm --filter @repo/spike-email build`
et le `COPY` du `dist` du spike ; dans `apps/web/nginx.conf`, retirer les deux blocs
`/spike-email/`. Puis `pnpm install` pour le lockfile.

## Ce que fait l'app

- **Composer** : destinataires, objet, corps ; un modèle ou un cas préparé les remplit. Les
  liens Mail (`mailto:`), Outlook (`ms-outlook://compose`) et Gmail (`googlegmail:///co`)
  ouvrent le brouillon ; tout est encodé par `encodeURIComponent`, sauts de ligne en CRLF.
- **Partager avec le QR** : feuille de partage avec `public/qr-retrait.png` joint. Le QR
  encode `4821` ; il a été produit par `qrencode -o public/qr-retrait.png -s 10 -m 4 -l M 4821`.
- **Modèles** : variables `{prénom}`, `{nom}`, `{code}`, `{colis}`, `{lieu}`, `{horaires}`,
  `{agent}`, `{lien_pas_moi}`, `{lien_collegue}` ; une variable inconnue reste visible et
  signalée.
- **Journal** : chaque ouverture, avec « app quittée » si la page est passée en arrière-plan
  dans les 2 s ; chaque chargement de la page compté (« page rechargée ensuite ») ; verdict
  et note saisis à la main ; export JSON.
- Le brouillon en cours survit au retour de la messagerie (iOS recharge parfois la PWA).
