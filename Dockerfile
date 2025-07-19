# Multi-stage build for Sa Plays Roblox Streamer
FROM node:18-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY vite.config.ts ./
COPY tailwind.config.ts ./
COPY postcss.config.js ./
COPY components.json ./
COPY drizzle.config.ts ./

# Install dependencies
RUN npm ci

# Copy source code
COPY client/ ./client/
COPY server/ ./server/
COPY shared/ ./shared/

# Build application
RUN npm run build
RUN ls -la dist/

# Production stage
FROM node:18-alpine AS production

# Install system dependencies
RUN apk add --no-cache \
    ffmpeg \
    nginx \
    nginx-mod-rtmp \
    postgresql-client \
    curl \
    bash \
    su-exec \
    shadow

# Create app user
RUN addgroup -g 1001 -S streaming && \
    adduser -S streaming -u 1001

# Create directories
RUN mkdir -p /app/uploads /app/backups /var/www/html/hls /var/log/nginx
RUN chown -R streaming:streaming /app/uploads /app/backups /var/www/html/hls

WORKDIR /app

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/drizzle.config.ts ./
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/shared ./shared

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Copy startup script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Don't switch user here - let entrypoint handle it
# USER streaming

# Expose ports
EXPOSE 5000 80 1935

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5000/api/videos || exit 1

# Start application
CMD ["/docker-entrypoint.sh"]