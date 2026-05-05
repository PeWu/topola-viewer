# Stage 1: Compile the React/TypeScript bundle
FROM node:20-alpine AS react-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Package static assets & Caddy binary on Distroless Static
FROM gcr.io/distroless/static-debian12
USER nonroot:nonroot
WORKDIR /app

# Copy static Caddy binary from the official Caddy image
COPY --from=caddy:2.7.6-alpine /usr/bin/caddy /usr/bin/caddy

# Copy Caddy server config with nonroot ownership
COPY --chown=nonroot:nonroot docker/Caddyfile ./

# Copy React build outputs with nonroot ownership to support strict read-only filesystem deployments
COPY --chown=nonroot:nonroot --from=react-builder /app/dist ./public

EXPOSE 8080
ENTRYPOINT ["/usr/bin/caddy", "run", "--config", "./Caddyfile", "--adapter", "caddyfile"]
