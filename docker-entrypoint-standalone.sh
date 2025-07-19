#!/bin/sh
set -e

echo "Starting Sa Plays Roblox Streamer (Standalone Docker Version)..."

# Wait for database
if [ -n "$DATABASE_URL" ]; then
    echo "Waiting for database..."
    
    # Extract host and port from DATABASE_URL
    DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
    DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    
    # Default to postgres defaults if extraction fails
    DB_HOST=${DB_HOST:-postgres}
    DB_PORT=${DB_PORT:-5432}
    
    # Wait for database to be ready
    for i in $(seq 1 30); do
        if nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; then
            echo "Database is ready!"
            break
        fi
        echo "Waiting for database... ($i/30)"
        sleep 2
    done
    
    if ! nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; then
        echo "Database connection timeout!"
        exit 1
    fi
else
    echo "No DATABASE_URL provided, skipping database check"
fi

# Create required directories
mkdir -p /app/uploads /app/backups /tmp/hls

# Set permissions
chown -R streaming:streaming /app/uploads /app/backups 2>/dev/null || true

# Start nginx in background (if available)
if command -v nginx >/dev/null 2>&1; then
    echo "Starting nginx for RTMP support..."
    # Test nginx configuration
    if nginx -t 2>/dev/null; then
        nginx -g 'daemon on;'
        echo "Nginx started successfully"
    else
        echo "Nginx configuration test failed, skipping nginx startup"
    fi
fi

# Start the application
echo "Starting Sa Plays Roblox Streamer application..."
cd /app

# Set NODE_ENV
export NODE_ENV=production

# Run the standalone server
exec node server-standalone.js