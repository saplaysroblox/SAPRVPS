# Docker Deployment Fix

## Issues Fixed

### 1. Missing server-standalone.js
**Problem**: The Docker container couldn't find `/app/server-standalone.js`
**Solution**: Updated Dockerfile.standalone to properly copy the server-standalone.js file

### 2. Nginx RTMP Module Missing  
**Problem**: Standard Alpine nginx doesn't include RTMP module
**Solution**: 
- Added `nginx-mod-rtmp` package to Dockerfile
- Updated nginx config to load the RTMP module with `load_module` directive
- Fixed permission issues with nginx log files

### 3. Permission Issues
**Problem**: nginx couldn't write to log files due to permission restrictions
**Solution**:
- Updated nginx config to use `/tmp` for log files (writable by non-root user)
- Removed user directive from nginx config (not needed in container)
- Set proper ownership of required directories

## Updated Files

1. **Dockerfile.standalone**: 
   - Added `nginx-mod-rtmp` and `netcat-openbsd` packages
   - Fixed file copying to ensure server-standalone.js is available
   - Improved directory permissions

2. **nginx-standalone.conf**:
   - Added `load_module` directive for RTMP module
   - Removed user directive (not needed in container)
   - Fixed log file paths to use `/tmp`

3. **docker-entrypoint-standalone.sh**:
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