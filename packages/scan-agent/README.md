# @repo/scan-agent — agent sur chaque rapport de scan

Accroche de `pnpm reports:pull --on-report` pendant la phase de test (D32, YSL-147) :
un agent `claude-opus-5-5` par rapport, dans un worktree depuis `origin/main`, et une PR
en draft seulement si rien de l'étiquette ne fuit dans le dépôt public et si rien ne
recule sur le banc. Retiré avec le reste avant les vrais utilisateurs (YSL-148).

```bash
pnpm reports:pull --watch --on-report 'pnpm -w reports:agent'
```

| Fichier                                         | Rôle                                                              |
| ----------------------------------------------- | ----------------------------------------------------------------- |
| `prompt.md`                                     | le prompt de l'agent, versionné                                   |
| `src/cli.ts`                                    | la commande, ses options, git et `gh` avec les droits d'Adam      |
| `src/run.ts`                                    | le déroulé d'un rapport, du verrou à la PR ou à `echec.md`        |
| `src/agent.ts`                                  | arguments et environnement de `claude -p`                         |
| `src/guard.ts`                                  | contrôle avant push : fichiers interdits, fuite, attribution      |
| `src/sandbox.ts`                                | profil `sandbox-exec` des gates et du banc lancés par la commande |
| `src/compare.ts`                                | banc avant/après : régressions, gains, tableau agrégé             |
| `src/groups.ts`, `src/report.ts`, `src/lock.ts` | regroupement par étiquette, lecture tolérante du rapport, verrou  |

Le détail, les contrôles et le journal : [`docs/rapports-scan.md`](../../docs/rapports-scan.md),
section « Agent sur chaque rapport ».
