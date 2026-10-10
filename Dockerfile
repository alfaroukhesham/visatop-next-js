# syntax=docker/dockerfile:1.7
# Default linux/arm64 when TARGETPLATFORM is unset (plain `docker build`); override: --build-arg TARGETPLATFORM=linux/amd64
ARG TARGETPLATFORM=linux/arm64
############################################
# Build stage
############################################
FROM --platform=$TARGETPLATFORM node:22-bookworm-slim AS builder

WORKDIR /app

# Avoid dev tooling noise; ensure openssl present for some deps/scripts
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

# Enable pnpm (project pins pnpm@10.x in packageManager)
RUN corepack enable

# Install deps (cache-friendly)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source and build
COPY . .
ENV NODE_ENV=production
# Next collects page data at build time; DB env must exist. Do not COPY .env* (see .dockerignore).
#   docker buildx build --secret id=env,src=.env.local --platform linux/arm64 ...
RUN --mount=type=secret,id=env \
  node scripts/docker-load-secret-env-and-build.mjs /run/secrets/env

############################################
# Runtime stage (small, glibc-friendly)
############################################
ARG TARGETPLATFORM=linux/arm64
FROM --platform=$TARGETPLATFORM node:22-bookworm-slim AS runner

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

WORKDIR /app

# Create non-root user
RUN groupadd -r nodejs && useradd -r -g nodejs nextjs

# Standalone output (smallest production bundle)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Next standalone output may include a copied `.env` from build time.
# We always provide runtime config via environment variables.
# Staging and production use different images and build secrets
# (STAGING_BUILD_ENV vs PROD_BUILD_ENV). Checkout Ads send_to belongs in
# PROD_BUILD_ENV only. Marketing tags are also gated at request time on Host
# visatop.com|www.visatop.com. Optional kill switch: ENABLE_MARKETING_TAGS=false.
RUN rm -f .env \
  && chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 3000

# Next standalone server entrypoint
CMD ["node", "server.js"]

