#!/bin/sh
# Applique les migrations, puis remplace le shell par l'API pour qu'elle
# reçoive directement SIGTERM au redéploiement.
set -e

cd /app/packages/db
./node_modules/.bin/drizzle-kit migrate

cd /app/apps/server
exec ./node_modules/.bin/tsx src/index.ts
