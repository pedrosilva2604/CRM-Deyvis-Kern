FROM node:24-alpine AS build
ENV HUSKY=0
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY frontend/package.json frontend/
RUN npm ci --workspace frontend --ignore-scripts
COPY shared/ shared/
COPY frontend/ frontend/
ARG VITE_APP_NAME
ENV VITE_APP_NAME=${VITE_APP_NAME}
RUN test -n "$VITE_APP_NAME" && npm run build --workspace frontend

FROM nginx:1.30.5-alpine AS runtime
COPY --chmod=755 frontend/nginx/10-require-environment.sh /docker-entrypoint.d/10-require-environment.sh
COPY frontend/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/frontend/dist /usr/share/nginx/html
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider "http://127.0.0.1:${WEB_LISTEN_PORT}/" || exit 1
