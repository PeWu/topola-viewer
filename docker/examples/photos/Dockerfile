# Stage 1: Multi-stage helper to zip GEDCOM & photos together preserving directory structure
FROM alpine:latest AS zipper
RUN apk add --no-cache zip
WORKDIR /build
COPY family.ged ./
COPY photos/ ./photos/
# Zip contents relative to build root to preserve directories as referenced in GEDCOM
RUN zip -r family.gdz family.ged photos/

# Stage 2: Load the zip file into the official container
FROM ghcr.io/pewu/topola-viewer:latest
COPY --from=zipper /build/family.gdz /app/public/family.gdz
ENV STATIC_URL=family.gdz
