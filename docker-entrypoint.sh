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

# Install TypeScript and drizzle-kit if not available
if ! command -v tsx &> /dev/null; then
    echo "Installing tsx for TypeScript execution..."
    npm install -g tsx
fi

if ! command -v drizzle-kit &> /dev/null; then
    echo "Installing drizzle-kit..."
    npm install -g drizzle-kit
fi

# Ensure all dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "Installing Node.js dependencies..."
    npm ci --only=production --no-optional
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
    # Test nginx configuration first
    if nginx -t 2>/dev/null; then
        nginx -g "daemon off;" &
    else
        echo "Nginx configuration test failed, skipping nginx startup"
    fi
else
    # Start nginx as current user if not root
    if nginx -t 2>/dev/null; then
        nginx -g "daemon off;" &
    else
        echo "Nginx configuration test failed, skipping nginx startup"
    fi
fi

# Wait a moment for nginx to start
sleep 2

# Start the application
echo "Starting Sa Plays Roblox Streamer application..."
cd /app

# Check if the built application exists
echo "Checking for built application files..."
ls -la dist/ 2>/dev/null || echo "dist/ directory not found"

# Use the wrapper script for better compatibility
if [ -f "server.mjs" ] && [ -f "dist/index.js" ]; then
    echo "Using production server wrapper: server.mjs"
    SERVER_FILE="server.mjs"
elif [ -f "dist/index.js" ]; then
    echo "Found application at dist/index.js"
    SERVER_FILE="dist/index.js"
elif [ -f "dist/server/index.js" ]; then
    echo "Found application at dist/server/index.js" 
    SERVER_FILE="dist/server/index.js"
else
    echo "ERROR: Built application not found"
    echo "Available files in dist/:"
    find dist/ -name "*.js" 2>/dev/null || echo "No JavaScript files found"
    echo "Cannot find built application, exiting..."
    exit 1
fi

# Check if file is actually executable
if [ ! -s "$SERVER_FILE" ]; then
    echo "ERROR: Server file $SERVER_FILE is empty or not readable"
    exit 1
fi

echo "Using server file: $SERVER_FILE"

# Debug the server file before running
echo "Debugging server file: $SERVER_FILE"
head -20 "$SERVER_FILE" 2>/dev/null || echo "Cannot read server file"

# Set NODE_ENV for production
export NODE_ENV=production

# Ensure we're running as the correct user
if [ "$(id -u)" = "0" ]; then
    echo "Switching to streaming user..."
    exec su-exec streaming node --experimental-modules "$SERVER_FILE"
else
    exec node --experimental-modules "$SERVER_FILE"
fi