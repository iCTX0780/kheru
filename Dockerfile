# syntax=docker/dockerfile:1

# Free Kheru studio — serves the web app (TTS runs in the browser).
# See docs/free-docker-split.md

ARG NODE_VERSION=22-bookworm-slim

FROM node:${NODE_VERSION} AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY .npmrc ./
COPY apps/kheru/package.json apps/kheru/

RUN pnpm install --frozen-lockfile --filter kheru...

COPY apps/kheru apps/kheru

RUN pnpm --filter kheru build

FROM node:${NODE_VERSION} AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

# Nitro / TanStack Start standalone output
COPY --from=builder /app/apps/kheru/.output ./.output

USER node
EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
