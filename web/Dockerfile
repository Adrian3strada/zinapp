FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV SITE_URL=https://zinapp.com.mx
ENV DJANGO_ORIGIN=http://127.0.0.1:8000
RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends caddy \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY Caddyfile /etc/caddy/Caddyfile
COPY scripts/start.sh /start.sh
RUN sed -i 's/\r$//' /start.sh /etc/caddy/Caddyfile \
    && chmod +x /start.sh

EXPOSE 8080
CMD ["/start.sh"]
