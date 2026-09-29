FROM node:24-alpine AS base
RUN apk add --no-cache openssl
ENV HUSKY=0
WORKDIR /app

FROM base AS build
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --workspace backend --ignore-scripts
COPY backend/ backend/
RUN npx --workspace backend prisma generate \
  && npm run build --workspace backend

FROM build AS migrator
WORKDIR /app/backend
CMD ["npx", "prisma", "migrate", "deploy"]

FROM base AS production-dependencies
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --workspace backend --omit=dev --omit=optional --ignore-scripts \
  && mkdir -p backend/node_modules

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=production-dependencies --chown=node:node /app/backend/node_modules ./backend/node_modules
COPY --from=build --chown=node:node /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build --chown=node:node /app/backend/package.json ./backend/package.json
COPY --from=build --chown=node:node /app/backend/dist ./backend/dist
WORKDIR /app/backend
USER node
EXPOSE 3333
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/api/health').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"
STOPSIGNAL SIGTERM
CMD ["node", "dist/server.js"]
