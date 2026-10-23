# Image de production de l'API. Le contexte de build est la racine du dépôt :
#   docker build -f apps/server/Dockerfile .
# L'API tourne sous tsx comme en local ; les migrations Drizzle passent au
# démarrage, avant d'ouvrir le port.

FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm fetch --frozen-lockfile

FROM deps AS runner
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --offline --frozen-lockfile --filter @repo/server...
RUN chmod +x apps/server/docker-entrypoint.sh && chown -R node:node /app

ENV NODE_ENV=production \
    SERVER_PORT=3101
USER node
EXPOSE 3101

HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.SERVER_PORT+'/health').then((r)=>process.exit(r.ok?0:1),()=>process.exit(1))"

ENTRYPOINT ["apps/server/docker-entrypoint.sh"]
