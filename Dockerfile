############################################
# Build stage
############################################
FROM node:22-bookworm-slim AS builder

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
RUN pnpm build

############################################
# Runtime stage (small, glibc-friendly)
############################################
FROM node:22-bookworm-slim AS runner

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
RUN rm -f .env

USER nextjs
EXPOSE 3000

# Next standalone server entrypoint
CMD ["node", "server.js"]

