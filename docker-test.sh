#!/bin/bash

# Sa Plays Roblox Streamer - Docker Test Script
# This script tests the Docker setup and troubleshoots common issues

set -e

echo "🧪 Testing Sa Plays Roblox Streamer Docker Setup..."
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_step() {
    echo -e "${GREEN}[TEST]${NC} $1"
}

print_info() {
    echo -e "${YELLOW}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

# Check if Docker is running
print_step "Checking Docker availability..."
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running or not accessible"
    exit 1
fi
print_success "Docker is running"

# Check if docker-compose is available
print_step "Checking docker-compose..."
if ! command -v docker-compose > /dev/null 2>&1; then
    print_error "docker-compose is not installed"
    exit 1
fi
print_success "docker-compose is available"

# Stop any existing containers
print_step "Cleaning up existing containers..."
docker-compose down -v 2>/dev/null || true
print_success "Cleanup completed"

# Build and start services
print_step "Building and starting services..."
docker-compose up -d --build

# Wait for services to be ready
print_step "Waiting for services to start..."
sleep 15

# Check service status
print_step "Checking service status..."
docker-compose ps

# Check if containers are running
POSTGRES_STATUS=$(docker-compose ps postgres | grep "Up" || echo "")
APP_STATUS=$(docker-compose ps sa-plays-streamer | grep "Up" || echo "")

if [ -z "$POSTGRES_STATUS" ]; then
    print_error "PostgreSQL container is not running"
    print_info "PostgreSQL logs:"
    docker-compose logs postgres | tail -20
    exit 1
fi
print_success "PostgreSQL container is running"

if [ -z "$APP_STATUS" ]; then
    print_error "Application container is not running"
    print_info "Application logs:"
    docker-compose logs sa-plays-streamer | tail -20
    exit 1
fi
print_success "Application container is running"

# Test database connection
print_step "Testing database connection..."
DB_TEST=$(docker-compose exec -T postgres psql -U neondb_owner -d neondb -c "SELECT 1;" 2>/dev/null || echo "")
if [ -z "$DB_TEST" ]; then
    print_error "Cannot connect to database"
    docker-compose logs postgres | tail -10
    exit 1
fi
print_success "Database connection successful"

# Test application endpoints
print_step "Testing application endpoints..."

# Wait a bit more for app to be ready
sleep 10

# Test health endpoint
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/api/videos || echo "000")
if [ "$HTTP_STATUS" != "200" ]; then
    print_error "Application health check failed (HTTP $HTTP_STATUS)"
    print_info "Application logs:"
    docker-compose logs sa-plays-streamer | tail -20
    exit 1
fi
print_success "Application health check passed"

# Test port accessibility
print_step "Testing port accessibility..."

# Test web port (5000)
if ! nc -z localhost 5000 2>/dev/null; then
    print_error "Port 5000 is not accessible"
    print_info "Checking port mappings..."
    docker-compose port sa-plays-streamer 5000 || echo "Port mapping not found"
    exit 1
fi
print_success "Port 5000 (web) is accessible"

# Test RTMP port (1935)
if ! nc -z localhost 1935 2>/dev/null; then
    print_error "Port 1935 is not accessible"
    print_info "Checking RTMP port mapping..."
    docker-compose port sa-plays-streamer 1935 || echo "Port mapping not found"
    exit 1
fi
print_success "Port 1935 (RTMP) is accessible"

# Test API endpoints
print_step "Testing API endpoints..."

# Test system config
SYSTEM_CONFIG=$(curl -s http://localhost:5000/api/system-config || echo "")
if [ -z "$SYSTEM_CONFIG" ]; then
    print_error "System config endpoint failed"
    exit 1
fi
print_success "System config endpoint working"

# Test stream status
STREAM_STATUS=$(curl -s http://localhost:5000/api/stream-status || echo "")
if [ -z "$STREAM_STATUS" ]; then
    print_error "Stream status endpoint failed"
    exit 1
fi
print_success "Stream status endpoint working"

# Show final status
echo ""
echo -e "${GREEN}🎉 All tests passed!${NC}"
echo "=================================================="
echo -e "${BLUE}Service Information:${NC}"
echo "• Web Interface: http://localhost:5000"
echo "• RTMP Endpoint: rtmp://localhost:1935/live"
echo "• Database: localhost:5432 (neondb)"
echo ""
echo -e "${BLUE}Management Commands:${NC}"
echo "• View logs: docker-compose logs -f"
echo "• Stop services: docker-compose down"
echo "• Restart: docker-compose restart"
echo ""
print_success "Sa Plays Roblox Streamer is ready to use!"