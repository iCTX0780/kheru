# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS build
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/kheru/package.json apps/kheru/

RUN pnpm install --frozen-lockfile || pnpm install

COPY apps/kheru apps/kheru

WORKDIR /app/apps/kheru
RUN pnpm build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/kheru/package.json apps/kheru/

# Hoist deps to /app/node_modules so Nitro externals resolve from /app/.output/server.
RUN printf 'node-linker=hoisted\n' > .npmrc \
    && pnpm install --frozen-lockfile --prod --filter kheru || pnpm install --prod --filter kheru

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV DATA_DIR=/data
ENV GENTLE_URL=http://gentle:8765
ENV GENTLE_WAIT_SECS=180

COPY --from=build /app/apps/kheru/.output /app/.output
COPY apps/kheru/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/docker-entrypoint.sh"]
