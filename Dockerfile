# Build stage
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV BUILD_STANDALONE=1
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# The official node image already ships a `node` user at uid/gid 1000. Using
# it means a host bind mount owned by the host user (tom = 1000) is writable
# without chowning inside the container.
RUN mkdir -p /app/data/uploads && chown -R node:node /app/data

# Install su-exec for safe step-down from root to node user
RUN apk add --no-cache su-exec

# node:sqlite is a built-in module in Node 22 — no native compile needed.
COPY --from=builder --chown=node:node /app/public ./public
# The schema is read from disk at runtime, so it must ship with the app.
COPY --from=builder --chown=node:node /app/lib/schema.sql ./lib/schema.sql
# The seed script ships too, so a fresh container can be populated with
# sample data:  docker exec smpl node scripts/seed.mjs
COPY --from=builder --chown=node:node /app/scripts/seed.mjs ./scripts/seed.mjs
COPY --from=builder --chown=node:node /app/scripts/backup-db.mjs ./scripts/backup-db.mjs
# The StuffDB importer ships with the app so a container can import a
# workbook without reaching back to the host checkout. It loads the same
# TypeScript modules the server uses, so those files ship alongside it.
COPY --from=builder --chown=node:node /app/scripts/import-stuffdb.mjs ./scripts/import-stuffdb.mjs
COPY --from=builder --chown=node:node /app/scripts/xlsx.mjs ./scripts/xlsx.mjs
COPY --from=builder --chown=node:node /app/lib/db.ts ./lib/db.ts
COPY --from=builder --chown=node:node /app/lib/dates.ts ./lib/dates.ts
COPY --from=builder --chown=node:node /app/lib/format.ts ./lib/format.ts
COPY --from=builder --chown=node:node /app/lib/storage.ts ./lib/storage.ts
COPY --from=builder --chown=node:node /app/lib/stuffdb-map.ts ./lib/stuffdb-map.ts
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# The SQLite file and uploaded photos live in /app/data.
# In Railway/production, mount a persistent volume at /app/data.
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "server.js"]
