# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS build
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/kheru/package.json apps/kheru/
COPY apps/web/package.json apps/web/

RUN pnpm install --frozen-lockfile || pnpm install

COPY apps/kheru apps/kheru

WORKDIR /app/apps/kheru
RUN pnpm build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends piper-tts && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV VOICES_DIR=/voices
ENV DATA_DIR=/data

COPY --from=build /app/apps/kheru/.output /app/.output

EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
