FROM node:20-slim

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --only=production

# Copy application code
COPY src/ ./src/
COPY public/ ./public/

# Cloud Run uses PORT env var
ENV PORT=8080
ENV NODE_ENV=production

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD curl -f http://localhost:8080/health || exit 1

CMD ["node", "src/server.js"]
