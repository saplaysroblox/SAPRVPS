# Docker Troubleshooting Guide for Sa Plays Roblox Streamer

## Common Docker Issues and Solutions

### 1. Schema File Not Found Error
**Error**: `Error  No schema files found for path config ['./shared/schema.ts']`

**Root Cause**: The Docker container cannot find the TypeScript schema file because it's looking for the source files instead of the compiled output.

**Solution**: The updated docker-entrypoint.sh now automatically handles this by:
- Checking if the schema file exists in the source location
- If not found, looking for compiled JavaScript version in dist/shared/
- Creating appropriate drizzle configuration file (JS or TS)
- Using the correct config file path for migrations

### 2. Database Connection Issues
**Error**: `DATABASE_URL must be set. Did you forget to provision a database?`

**Solution**:
1. Ensure your `.env` file or docker-compose.yml has the correct DATABASE_URL
2. For local Docker setup, use: `postgresql://neondb_owner:npg_lt4QRoXDb8Pf@postgres:5432/neondb`
3. Wait for PostgreSQL container to be fully ready before starting the app

### 3. Port Binding Issues
**Error**: Container starts but application not accessible

**Solution**:
Ensure all required ports are exposed in docker-compose.yml:
```yaml
ports:
  - "5000:5000"  # Web application
  - "80:80"      # Nginx (optional)
  - "1935:1935"  # RTMP streaming
  - "5432:5432"  # PostgreSQL (for external access)
```

### 4. Permission Issues
**Error**: Permission denied when creating directories or files

**Solution**: The docker-entrypoint.sh now handles permissions correctly by:
- Running initial setup as root
- Creating required directories with proper ownership
- Switching to non-root `streaming` user for the application

### 5. Build Failures and Module Errors
**Error**: Build process fails during Docker build, or `ERR_INVALID_ARG_TYPE` path resolution errors

**Root Cause**: Node.js modules not properly installed or import.meta paths not working in bundled output

**Solution**:
1. Ensure Node.js dependencies are installed in production stage: `npm ci --only=production`
2. Use production server wrapper (server.mjs) that handles path resolution issues
3. Verify all source files are properly copied in Dockerfile
4. Check that shared/ directory is included in the production image
5. The updated docker-entrypoint.sh now automatically handles dependency installation

## Quick Start Commands

### Build and Run with Docker Compose
```bash
docker-compose up --build
```

### Run with Custom Environment
```bash
POSTGRES_PASSWORD=your_password docker-compose up --build
```

### Check Logs
```bash
# View application logs
docker-compose logs sa-plays-streamer

# View database logs  
docker-compose logs postgres

# Follow logs in real-time
docker-compose logs -f
```

### Clean Rebuild
```bash
# Stop and remove containers
docker-compose down

# Remove volumes (WARNING: This will delete your data)
docker-compose down -v

# Rebuild from scratch
docker-compose up --build --force-recreate
```

## Environment Variables

### Required Variables
- `DATABASE_URL`: PostgreSQL connection string
- `NODE_ENV`: Set to "production" for Docker
- `POSTGRES_PASSWORD`: Database password (default: npg_lt4QRoXDb8Pf)

### Optional Variables
- `PORT`: Application port (default: 5000)
- `PGHOST`: Database host (default: postgres for Docker)
- `PGPORT`: Database port (default: 5432)

## Health Checks

The application includes health checks to ensure everything is running properly:

### Application Health Check
```bash
curl -f http://localhost:5000/api/videos
```

### Database Health Check
```bash
docker-compose exec postgres pg_isready -U neondb_owner -d neondb
```

## File Structure in Container

```
/app/
├── dist/                 # Compiled application
│   ├── server/          # Backend code
│   ├── public/          # Frontend assets
│   └── shared/          # Shared schemas (compiled to JS)
├── node_modules/        # Dependencies
├── uploads/             # Video uploads
├── backups/             # Database backups
├── shared/              # Source TypeScript schemas
├── drizzle.config.ts    # TypeScript config (development)
├── drizzle.config.js    # JavaScript config (production fallback)
└── package.json
```

## Networking

The application uses a custom Docker network `sa-plays-network` to enable communication between services:
- `postgres`: Database container
- `sa-plays-streamer`: Main application container
- `redis`: Caching (optional)

## Data Persistence

Docker volumes are used for data persistence:
- `postgres_data`: Database files
- `uploads_data`: Video uploads
- `hls_data`: HLS streaming files
- `backups_data`: Database backups
- `redis_data`: Redis cache (optional)

## Troubleshooting Steps

1. **Check container status**: `docker-compose ps`
2. **View logs**: `docker-compose logs [service-name]`
3. **Verify environment variables**: `docker-compose config`
4. **Test database connection**: `docker-compose exec postgres psql -U neondb_owner -d neondb`
5. **Restart services**: `docker-compose restart [service-name]`

## Development vs Production

### Development
- Uses source TypeScript files
- Hot reload enabled
- Debug logging
- Direct file access

### Production (Docker)
- Uses compiled JavaScript
- Optimized builds
- Proper user permissions
- Health checks enabled

## Contact Information

If you continue to experience issues after following this guide, please check:
1. Docker and Docker Compose versions are up to date
2. Sufficient disk space and memory available
3. No conflicting services running on required ports
4. All environment variables are properly set