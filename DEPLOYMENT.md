# Sa Plays Roblox Streamer - Deployment Guide

## Overview

This guide covers deployment options for the Sa Plays Roblox Streamer application, a full-stack video streaming platform with React frontend and Node.js backend.

## Quick Deploy Options

### 1. Replit Deployment (Recommended)
The application is already configured for Replit deployment:

```bash
# The application runs automatically in Replit
# Click "Deploy" button in Replit interface
```

**Features:**
- Automatic PostgreSQL database provisioning
- Built-in HTTPS and custom domains
- Zero-configuration deployment
- Automatic scaling and monitoring

### 2. Docker Deployment

**Prerequisites:**
- Docker and Docker Compose installed
- PostgreSQL database (included in docker-compose.yml)

**Quick Start:**
```bash
# Clone the repository
git clone <repository-url>
cd sa-plays-roblox-streamer

# Build and run with Docker Compose
docker-compose up --build

# Access the application
open http://localhost:5000
```

**Docker Configuration:**
- **Web Application:** Port 5000
- **RTMP Streaming:** Port 1935
- **PostgreSQL:** Port 5432
- **Nginx (optional):** Port 80

### 3. Manual Server Deployment

**Prerequisites:**
- Node.js 18+ 
- PostgreSQL database
- FFmpeg for video processing
- Nginx with RTMP module (for streaming)

**Installation Steps:**
```bash
# Install dependencies
npm ci --only=production

# Set environment variables
export DATABASE_URL="postgresql://user:password@host:port/database"
export NODE_ENV="production"

# Build the application
npm run build

# Run database migrations
npm run db:push

# Start the server
npm start
```

## Environment Configuration

### Required Environment Variables
```bash
DATABASE_URL=postgresql://username:password@host:port/database
NODE_ENV=production
PORT=5000
```

### Optional Environment Variables
```bash
PGHOST=localhost
PGPORT=5432
PGUSER=username
PGPASSWORD=password
PGDATABASE=database_name
```

## Database Setup

### Automatic Setup (Docker)
When using Docker Compose, PostgreSQL is automatically configured with:
- Database: `neondb`
- User: `neondb_owner`
- Password: `npg_lt4QRoXDb8Pf` (configurable)

### Manual Database Setup
```sql
-- Create database and user
CREATE DATABASE streaming_db;
CREATE USER streaming_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE streaming_db TO streaming_user;

-- Run migrations using Drizzle
npm run db:push
```

## Streaming Configuration

### RTMP Setup
The application includes built-in RTMP streaming support:

1. **Local RTMP Server:** Runs on port 1935
2. **Stream Key Configuration:** Set via the application's Settings panel
3. **Supported Platforms:** YouTube Live, Twitch, Facebook Live, custom RTMP

### Nginx RTMP Configuration
```nginx
rtmp {
    server {
        listen 1935;
        application live {
            live on;
            allow publish 127.0.0.1;
            allow play all;
            
            # HLS output
            hls on;
            hls_path /tmp/hls;
            hls_fragment 3;
        }
    }
}
```

## File Storage

### Upload Directory
- **Local Path:** `./uploads/`
- **Docker Volume:** `uploads_data:/app/uploads`
- **Permissions:** Writable by application user

### Backup Directory
- **Local Path:** `./backups/`
- **Docker Volume:** `backups_data:/app/backups`
- **Purpose:** Database backups and exports

## Security Considerations

### Production Security
1. **Database:** Use strong passwords and restrict network access
2. **RTMP:** Configure publish permissions appropriately
3. **File Uploads:** Validate file types and sizes
4. **HTTPS:** Always use HTTPS in production (handled by Replit automatically)
5. **Environment Variables:** Never commit secrets to version control

### Docker Security
```yaml
# Production docker-compose.yml security settings
services:
  sa-plays-streamer:
    user: streaming:streaming  # Non-root user
    read_only: true           # Read-only filesystem
    volumes:
      - uploads_data:/app/uploads:rw
      - backups_data:/app/backups:rw
```

## Monitoring and Maintenance

### Health Checks
The application includes built-in health checks:
- **HTTP:** `GET /api/videos` (should return 200)
- **Database:** Connection status via API
- **Docker:** Automatic container health monitoring

### Log Monitoring
```bash
# Docker logs
docker-compose logs -f sa-plays-streamer

# Application logs
tail -f /var/log/sa-plays-streamer.log
```

### Database Maintenance
```bash
# Create backup
curl -X POST http://localhost:5000/api/database/backup

# List backups
curl http://localhost:5000/api/database/backups

# Restore from backup
curl -F "backup=@backup.sql" http://localhost:5000/api/database/restore
```

## Scaling and Performance

### Horizontal Scaling
- Use a load balancer for multiple application instances
- Separate database server for high availability
- CDN for static asset delivery

### Performance Optimization
```bash
# Enable gzip compression
# Use Redis for session storage
# Optimize video encoding settings
# Configure proper caching headers
```

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   ```bash
   # Check DATABASE_URL format
   # Verify database server is running
   # Test connection: psql $DATABASE_URL
   ```

2. **Port Already in Use**
   ```bash
   # Find process using port 5000
   lsof -i :5000
   # Kill process or change PORT environment variable
   ```

3. **File Upload Failures**
   ```bash
   # Check disk space: df -h
   # Verify upload directory permissions
   # Check file size limits
   ```

4. **RTMP Streaming Issues**
   ```bash
   # Verify port 1935 is open
   # Check stream key configuration
   # Test with: ffmpeg -i input.mp4 -f flv rtmp://localhost:1935/live/stream_key
   ```

### Docker-Specific Issues
See `DOCKER_TROUBLESHOOTING.md` for comprehensive Docker troubleshooting guide.

## Support and Documentation

- **Application Settings:** Configure via web interface at `/settings`
- **API Documentation:** Available at `/api` endpoints
- **Video Formats:** Supports MP4, AVI, MOV, MKV
- **Browser Support:** Modern browsers with HTML5 video support

## Backup and Recovery

### Automated Backups
```bash
# Schedule daily backups
0 2 * * * curl -X POST http://localhost:5000/api/database/backup
```

### Manual Backup
```bash
# Database backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# File backup
tar -czf uploads_backup_$(date +%Y%m%d).tar.gz uploads/
```

### Recovery Process
```bash
# Restore database
psql $DATABASE_URL < backup_file.sql

# Restore files
tar -xzf uploads_backup.tar.gz
```

---

For additional support, refer to the application's built-in help system or check the project documentation.