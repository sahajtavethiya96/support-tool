# syntax=docker/dockerfile:1

# ── Base image with pnpm enabled ──────────────────────────────────────────────
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# ── Install dependencies (cached on lockfile) ─────────────────────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ── Build the Next.js app ─────────────────────────────────────────────────────
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Placeholder env so `next build` passes env validation. Real values are
# provided at runtime; NEXT_PUBLIC_APP_URL is read server-side at request time.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
ENV APP_SECRET=build-time-placeholder-secret-not-used-at-runtime
ENV NEXT_PUBLIC_APP_URL=http://localhost:3000
# Optional: bake the Pusher Beams instance id into the client bundle (NEXT_PUBLIC_*
# vars are inlined at build time). Pass with:
#   docker compose build --build-arg NEXT_PUBLIC_PUSHER_BEAMS_INSTANCE_ID=xxxxxxxx
ARG NEXT_PUBLIC_PUSHER_BEAMS_INSTANCE_ID=""
ENV NEXT_PUBLIC_PUSHER_BEAMS_INSTANCE_ID=$NEXT_PUBLIC_PUSHER_BEAMS_INSTANCE_ID
# Optional: bake the Pusher Channels key/cluster into the client bundle (a
# different Pusher product from Beams above — enables real-time ticket
# updates). Pass with:
#   docker compose build --build-arg NEXT_PUBLIC_PUSHER_KEY=xxxxxxxx --build-arg NEXT_PUBLIC_PUSHER_CLUSTER=us2
ARG NEXT_PUBLIC_PUSHER_KEY=""
ENV NEXT_PUBLIC_PUSHER_KEY=$NEXT_PUBLIC_PUSHER_KEY
ARG NEXT_PUBLIC_PUSHER_CLUSTER=""
ENV NEXT_PUBLIC_PUSHER_CLUSTER=$NEXT_PUBLIC_PUSHER_CLUSTER
RUN pnpm build

# ── Runtime image (serves app or runs worker / migrations) ────────────────────
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Source is needed at runtime for the pg-boss worker (tsx) and drizzle migrations.
COPY . .
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
EXPOSE 3000
# Overridden per-service in docker-compose (app / worker / migrate).
CMD ["pnpm", "start"]
