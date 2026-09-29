FROM node:24-alpine AS build
ENV HUSKY=0
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --workspace frontend --ignore-scripts
COPY frontend/ frontend/
ARG VITE_APP_NAME
ENV VITE_APP_NAME=${VITE_APP_NAME}
RUN test -n "$VITE_APP_NAME" && npm run build --workspace frontend

FROM nginx:1.27-alpine AS runtime
ENV API_UPSTREAM=http://api:3333
COPY frontend/nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/ || exit 1
