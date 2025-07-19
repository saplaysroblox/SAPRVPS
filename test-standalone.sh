#!/bin/bash

echo "=========================================="
echo "Testing Sa Plays Roblox Streamer - Docker Standalone"
echo "=========================================="

# Build frontend first
echo "Step 1: Building frontend..."
vite build client --outDir dist/public

if [ $? -ne 0 ]; then
    echo "❌ Frontend build failed"
    exit 1
fi

echo "✅ Frontend built successfully"

# Test standalone server locally
echo "Step 2: Testing standalone server..."

# Check if we have DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    echo "Setting up test database URL..."
    export DATABASE_URL="postgresql://neondb_owner:npg_lt4QRoXDb8Pf@localhost:5432/neondb"
fi

echo "Database URL: $DATABASE_URL"

# Start standalone server in background
echo "Starting standalone server..."
NODE_ENV=production node server-standalone.js &
SERVER_PID=$!

# Wait for server to start
sleep 5

# Test health endpoint
echo "Step 3: Testing health endpoint..."
HEALTH_CHECK=$(curl -s http://localhost:5000/health 2>/dev/null)

if [ $? -eq 0 ]; then
    echo "✅ Health check passed: $HEALTH_CHECK"
else
    echo "❌ Health check failed"
    kill $SERVER_PID 2>/dev/null
    exit 1
fi

# Test API endpoints
echo "Step 4: Testing API endpoints..."

# Test videos endpoint
VIDEOS_TEST=$(curl -s http://localhost:5000/api/videos 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "✅ Videos API working"
else
    echo "❌ Videos API failed"
fi

# Test stream status
STREAM_TEST=$(curl -s http://localhost:5000/api/stream-status 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "✅ Stream status API working"
else
    echo "❌ Stream status API failed"
fi

# Stop server
kill $SERVER_PID 2>/dev/null
echo "Server stopped"

echo "=========================================="
echo "Local testing complete!"
echo "=========================================="

# Test Docker build
echo "Step 5: Testing Docker build..."
if command -v docker &> /dev/null; then
    echo "Building Docker image..."
    docker build -f Dockerfile.standalone -t sa-plays-streamer-test .
    
    if [ $? -eq 0 ]; then
        echo "✅ Docker build successful"
        echo ""
        echo "To run with Docker Compose:"
        echo "docker-compose -f docker-compose-standalone.yml up --build"
    else
        echo "❌ Docker build failed"
    fi
else
    echo "⚠️ Docker not available, skipping Docker test"
fi

echo "=========================================="
echo "All tests completed!"
echo "=========================================="