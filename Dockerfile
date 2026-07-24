# Multi-stage Dockerfile for Minn Creative Studio
# Stage 1: Build the React SPA
FROM node:22-slim AS builder
WORKDIR /app

# Install build tools for native SQLite/Sharp dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .

# Build the frontend assets with capped memory limit
RUN NODE_OPTIONS="--max-old-space-size=1024" npm run build

# Stage 2: Production runner
FROM node:22-slim AS runner
WORKDIR /app

# Install build tools for any required native SQLite rebuilding at runtime
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --only=production

# Copy built frontend assets and backend source code
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/backend ./backend
COPY --from=builder /app/src ./src
COPY --from=builder /app/server.ts ./server.ts

# Create mounting points for SQLite db and media assets
RUN mkdir -p data storage

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_PATH=/app/data/minn-studio.db
ENV STORAGE_PATH=/app/storage

CMD ["npm", "start"]
