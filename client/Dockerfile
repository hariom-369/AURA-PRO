# Vite bakes env vars in at build time, so every VITE_* value the app reads
# must be supplied as a build arg (docker build --build-arg VITE_API_URL=...
# --build-arg VITE_GOOGLE_CLIENT_ID=... etc.) — a build arg with no matching
# ARG line below is silently dropped by Docker. VITE_GOOGLE_CLIENT_ID and
# VITE_TURNSTILE_SITE_KEY are optional (each feature just doesn't render if
# unset), unlike VITE_API_URL which is required for the app to work at all.
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_TURNSTILE_SITE_KEY
ENV VITE_API_URL=$VITE_API_URL \
    VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID \
    VITE_TURNSTILE_SITE_KEY=$VITE_TURNSTILE_SITE_KEY
RUN npm run build

# --- runtime: static files served by nginx ---
FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q -O- http://localhost:80/ >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
