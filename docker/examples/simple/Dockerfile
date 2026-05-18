# Start from the official compiled container
FROM ghcr.io/pewu/topola-viewer:latest

# Copy the unzipped GEDCOM file directly into public folder
COPY family.ged /app/public/family.ged

# Configure server to pre-load this raw GEDCOM file
ENV STATIC_URL=family.ged
