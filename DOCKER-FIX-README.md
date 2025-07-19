# Docker Deployment Fix

## Issues Fixed

### 1. Missing server-standalone.js
**Problem**: The Docker container couldn't find `/app/server-standalone.js`
**Solution**: Updated Dockerfile.standalone to properly copy the server-standalone.js file

### 2. ES Module Syntax Error
**Problem**: server-standalone.js was using ES modules (import/export) but Node.js treated it as CommonJS
**Solution**: 
- Converted server-standalone.js from ES modules to CommonJS (require/module.exports)
- Created package-standalone.json without "type": "module"
- Fixed __dirname reference for CommonJS

### 3. Nginx RTMP Module Issues  
**Problem**: Standard Alpine nginx's RTMP module caused configuration errors
**Solution**: 
- Created nginx-standalone-simple.conf without RTMP for basic functionality
- Added nginx-mod-rtmp package to Dockerfile for future RTMP support
- Used /tmp directory for nginx logs to avoid permission issues

### 4. Dependency Management
**Problem**: Docker container wasn't properly installing production dependencies
**Solution**:
- Created dedicated package-standalone.json with minimal dependencies
- Updated Dockerfile to install production dependencies in container
- Separated build dependencies from runtime dependencies

### 5. nanoid ES Module Compatibility
**Problem**: nanoid v5+ is ES-only and can't be required() in CommonJS
**Solution**:
- Downgraded nanoid to v3.3.7 which supports CommonJS
- Added fallback ID generator in case nanoid fails to load
- Maintained compatibility with existing file naming system

### 6. PostgreSQL SSL Connection Error
**Problem**: Docker PostgreSQL container rejects SSL connections causing initialization to fail
**Solution**:
- Updated database connection logic to disable SSL for Docker/local connections
- Added ?sslmode=disable to DATABASE_URL in docker-compose
- Enhanced connection detection for localhost, 127.0.0.1, and container hostnames

### 7. Missing API Endpoints
**Problem**: Frontend trying to access multiple endpoints that don't exist in server-standalone.js
**Solution**:
- Added /api/stream/set-current endpoint to handle setting current video for streaming
- Added /api/stream/restart endpoint for stream restart functionality
- Added /api/stream/loop/enable and /api/stream/loop/disable endpoints for 24x7 playlist loop
- Added /api/videos/reorder endpoint for drag-and-drop playlist reordering
- Added POST /api/system-config endpoint for saving system configuration
- Added database management endpoints: /api/database/install, /api/database/backup, /api/database/restore
- All endpoints provide proper error handling and validation

## Updated Files

1. **Dockerfile.standalone**: 
   - Added `nginx-mod-rtmp` and `netcat-openbsd` packages
   - Fixed file copying to ensure server-standalone.js is available
   - Updated to use package-standalone.json for dependencies
   - Improved directory permissions

2. **server-standalone.js**:
   - Converted from ES modules to CommonJS syntax
   - Fixed __dirname reference for Node.js compatibility
   - Simplified imports for better container compatibility

3. **package-standalone.json**:
   - Created minimal package.json for Docker container
   - Removed "type": "module" to allow CommonJS
   - Downgraded nanoid to v3.3.7 for CommonJS compatibility
   - Included only essential production dependencies

4. **nginx-standalone-simple.conf**:
   - Simplified nginx configuration without RTMP initially
   - Fixed log file paths to use `/tmp` directory
   - Added basic health check endpoint

5. **docker-entrypoint-standalone.sh**:
   - Improved nginx startup handling
   - Better error handling for nginx configuration test

## How to Deploy

### Option 1: Use Fixed Docker Compose (Recommended)
```bash
# Use the fixed docker compose file
docker-compose -f docker-compose-standalone-fixed.yml up --build
```

### Option 2: Use Original Docker Compose  
```bash
# Rebuild with fixes
docker-compose -f docker-compose-standalone.yml down
docker-compose -f docker-compose-standalone.yml up --build
```

## Verification

After deployment, check:

1. **Application Health**: `curl http://localhost:5000/health`
2. **API Endpoints**: `curl http://localhost:5000/api/videos`
3. **RTMP Streaming**: Stream to `rtmp://localhost:1935/live/streamkey`
4. **Container Logs**: `docker logs container_name`

The application should now start successfully without the "server-standalone.js not found" and nginx RTMP errors.