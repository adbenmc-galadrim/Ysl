# Image de production de l'app web. Le contexte de build est la racine du dépôt :
#   docker build -f apps/web/Dockerfile --build-arg PUBLIC_SERVER_URL=https://… --build-arg PUBLIC_APP_URL=https://… .
# Vite fige PUBLIC_* dans le bundle : changer l'URL de l'API demande un rebuild.

FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm fetch --frozen-lockfile
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --offline --frozen-lockfile --filter @repo/web...

ARG PUBLIC_APP_NAME=Courrier
ARG PUBLIC_SERVER_URL
ARG PUBLIC_APP_URL
ENV PUBLIC_APP_NAME=$PUBLIC_APP_NAME \
    PUBLIC_SERVER_URL=$PUBLIC_SERVER_URL \
    PUBLIC_APP_URL=$PUBLIC_APP_URL
# Modèles OCR (URL et sha256 épinglés) : hors du dépôt, requis par le build de l'app.
RUN pnpm --filter @repo/ocr models
RUN pnpm --filter @repo/web build

FROM nginx:1.29-alpine AS runner
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/web/nginx/isolation.conf /etc/nginx/snippets/isolation.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80

HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=5 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
