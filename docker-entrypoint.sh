#!/bin/bash
set -e

echo "Starting Sa Plays Roblox Streamer..."

# Switch to root temporarily for system tasks
if [ "$(id -u)" != "0" ]; then
    echo "Running as non-root user, some operations may require sudo"
else
    echo "Running as root, will switch to app user later"
fi

# Wait for database to be ready
echo "Waiting for database..."
until pg_isready -h postgres -U neondb_owner -d neondb; do
  echo "Database is unavailable - sleeping"
  sleep 2
done
echo "Database is ready"

# Set environment variables for Drizzle
export NODE_ENV=production
export DATABASE_URL="postgresql://neondb_owner:${POSTGRES_PASSWORD:-npg_lt4QRoXDb8Pf}@postgres:5432/neondb"

# Run database migrations
echo "Running database migrations..."
cd /app

# Check if schema file exists, if not create a symlink or copy
if [ ! -f "./shared/schema.ts" ]; then
    echo "Schema file not found, checking dist directory..."
    if [ -f "./dist/shared/schema.js" ]; then
        echo "Found compiled schema in dist, creating JavaScript drizzle config..."
        cat > drizzle.config.js << 'EOF'
const { defineConfig } = require("drizzle-kit");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

module.exports = defineConfig({
  out: "./migrations",
  schema: "./dist/shared/schema.js",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
EOF
        export DRIZZLE_CONFIG="./drizzle.config.js"
    else
        echo "No schema file found, creating minimal drizzle config..."
        cat > drizzle.config.js << 'EOF'
const { defineConfig } = require("drizzle-kit");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

module.exports = defineConfig({
  out: "./migrations",
  dialect: "postgresql", 
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
EOF
        export DRIZZLE_CONFIG="./drizzle.config.js"
    fi
else
    echo "Using existing TypeScript drizzle config"
    export DRIZZLE_CONFIG="./drizzle.config.ts"
fi

# Install TypeScript if not available (for drizzle-kit)
if ! command -v tsx &> /dev/null; then
    echo "Installing tsx for TypeScript execution..."
    npm install -g tsx
fi

# Run migrations with proper path
export PATH="/app/node_modules/.bin:$PATH"
echo "Running drizzle-kit push with config: $DRIZZLE_CONFIG..."
if [ -n "$DRIZZLE_CONFIG" ]; then
    npx drizzle-kit push --config="$DRIZZLE_CONFIG"
else
    npx drizzle-kit push
fi

# Create required directories
echo "Setting up directories..."
mkdir -p /app/uploads /app/backups /var/www/html/hls /var/log/nginx

# Fix permissions
if [ "$(id -u)" = "0" ]; then
    chown -R streaming:streaming /app/uploads /app/backups /var/www/html/hls
    chown -R nginx:nginx /var/log/nginx
else
    # Running as streaming user already
    chmod 755 /app/uploads /app/backups /var/www/html/hls
fi

# Start nginx in background
echo "Starting nginx..."
if [ "$(id -u)" = "0" ]; then
    nginx -g "daemon off;" &
else
    # Start nginx as current user if not root
    nginx -g "daemon off;" &
fi

# Wait a moment for nginx to start
sleep 2

# Start the application
echo "Starting Sa Plays Roblox Streamer application..."
cd /app

# Ensure we're running as the correct user
if [ "$(id -u)" = "0" ]; then
    echo "Switching to streaming user..."
    exec su-exec streaming node dist/server/index.js
else
    exec node dist/server/index.js
fi