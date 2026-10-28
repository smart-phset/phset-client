# syntax=docker/dockerfile:1.7
# Pin a reviewed digest as well as this supported LTS patch for a release build.
ARG NODE_IMAGE=node:24.22.1-bookworm-slim
FROM ${NODE_IMAGE} AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS dependencies
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

FROM base AS builder
COPY --from=dependencies /app/node_modules ./node_modules
# .dockerignore excludes ALL private environment files and host build output.
COPY . .
# Build with no runtime credentials. Do not add secret build arguments or ENV.
# Webpack is verified for this Next version; Turbopack needs helper socket access.
RUN npm run test && npm run lint && npm run build -- --webpack && npm run typecheck

FROM base AS runner
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
RUN groupadd --system --gid 1001 nextjs \
    && useradd --system --uid 1001 --gid nextjs --home-dir /app nextjs
COPY --from=builder --chown=nextjs:nextjs /app/public ./public
COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/.next/static ./.next/static
COPY --chown=nextjs:nextjs scripts/validate-runtime-env.mjs scripts/container-healthcheck.mjs ./scripts/
COPY --chmod=0555 deploy/docker-entrypoint.sh /usr/local/bin/smartphset-entrypoint
USER 1001:1001
EXPOSE 3000
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD ["node", "scripts/container-healthcheck.mjs"]
ENTRYPOINT ["/usr/local/bin/smartphset-entrypoint"]
CMD ["node", "server.js"]
