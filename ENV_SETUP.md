# Environment Configuration Guide

This guide explains how to set up the environment files for different deployment scenarios.

## Environment Files Overview

### 1. `.env.example`
Complete reference with all possible configuration options and detailed comments.

### 2. `.env.production`
Production-ready configuration with security-focused defaults.

### 3. `.env.docker`
Optimized for Docker Compose deployment with container-friendly settings.

## Quick Setup Instructions

### For Traditional Server Deployment

1. Copy the production template:
   ```bash
   cp .env.production .env
   ```

2. Edit the file and update these critical values:
   ```bash
   nano .env
   ```

3. **Required Changes:**
   - `DATABASE_URL`: Update with your PostgreSQL credentials
   - `PGPASSWORD`: Set your database password
   - `SESSION_SECRET`: Generate a secure random string (32+ characters)
   - `JWT_SECRET`: Generate another secure random string
   - `DOMAIN`: Set your domain name
   - `WEBHOOK_SECRET`: Generate a webhook secret

4. **Generate Secure Secrets:**
   ```bash
   # Generate secure random strings
   openssl rand -base64 32  # Use for SESSION_SECRET
   openssl rand -base64 32  # Use for JWT_SECRET
   openssl rand -base64 32  # Use for WEBHOOK_SECRET
   ```

### For Docker Deployment

1. Copy the Docker template:
   ```bash
   cp .env.docker .env
   ```

2. Update these values:
   - `POSTGRES_PASSWORD`: Strong database password
   - `SESSION_SECRET`: Secure random string (32+ characters)
   - `JWT_SECRET`: Secure random string (32+ characters)
   - `DOMAIN`: Your domain name
   - `WEBHOOK_SECRET`: Secure random string

### For Automated Setup

Use the provided setup script:
```bash
chmod +x setup-server.sh
./setup-server.sh
```

This script will:
- Install all dependencies
- Generate secure passwords automatically
- Create the environment file
- Set up the database
- Configure services

## Environment Variables Reference

### Database Settings
- `DATABASE_URL`: Full PostgreSQL connection string
- `PGHOST`: Database host (default: localhost)
- `PGPORT`: Database port (default: 5432)
- `PGDATABASE`: Database name
- `PGUSER`: Database username
- `PGPASSWORD`: Database password

### Application Settings
- `NODE_ENV`: Environment mode (production/development)
- `PORT`: Application port (default: 5000)
- `DOMAIN`: Your domain name
- `SSL_ENABLED`: Enable HTTPS (true/false)

### Security Settings
- `SESSION_SECRET`: Session encryption key (32+ characters)
- `JWT_SECRET`: JWT token secret (32+ characters)
- `WEBHOOK_SECRET`: Webhook verification secret
- `BCRYPT_ROUNDS`: Password hashing rounds (default: 12)

### RTMP Settings
- `RTMP_PORT`: RTMP server port (default: 1935)
- `RTMP_ALLOW_PUBLISH`: IP addresses allowed to publish
- `HLS_PATH`: Path for HLS segments
- `HLS_FRAGMENT_DURATION`: HLS fragment duration in seconds
- `HLS_PLAYLIST_LENGTH`: HLS playlist length in seconds

### File Upload Settings
- `UPLOAD_PATH`: Directory for uploaded files
- `MAX_FILE_SIZE`: Maximum file size for uploads
- `ALLOWED_EXTENSIONS`: Allowed file extensions

### Streaming Platform APIs (Optional)
- `YOUTUBE_API_KEY`: YouTube API key for integration
- `TWITCH_CLIENT_ID`: Twitch client ID
- `TWITCH_CLIENT_SECRET`: Twitch client secret
- `FACEBOOK_APP_ID`: Facebook app ID
- `FACEBOOK_APP_SECRET`: Facebook app secret

### Email Configuration (Optional)
- `SMTP_HOST`: SMTP server host
- `SMTP_PORT`: SMTP server port
- `SMTP_USER`: SMTP username
- `SMTP_PASSWORD`: SMTP password
- `FROM_EMAIL`: From email address

### Logging Settings
- `LOG_LEVEL`: Logging level (info/debug/warn/error)
- `LOG_FILE`: Log file path

### Performance Settings
- `RATE_LIMIT_WINDOW`: Rate limiting window in minutes
- `RATE_LIMIT_MAX_REQUESTS`: Maximum requests per window
- `FFMPEG_THREADS`: FFmpeg thread count (0 = auto)
- `FFMPEG_PRESET`: FFmpeg encoding preset

## Security Best Practices

1. **Never commit `.env` files to version control**
2. **Use strong, unique passwords for all services**
3. **Generate random secrets using cryptographically secure methods**
4. **Regularly rotate secrets and passwords**
5. **Use HTTPS in production**
6. **Limit database access to localhost**
7. **Enable firewall rules**

## Common Issues and Solutions

### Database Connection Issues
- Verify PostgreSQL is running: `sudo systemctl status postgresql`
- Check database exists: `sudo -u postgres psql -l`
- Test connection: `psql -h localhost -U streaming_user -d streaming_app`

### Permission Issues
- Ensure application user has proper permissions
- Check file ownership: `ls -la /opt/streaming-app/`
- Fix permissions: `sudo chown -R streaming:streaming /opt/streaming-app/`

### Port Conflicts
- Check if ports are in use: `sudo netstat -tulpn | grep :5000`
- Change PORT in .env file if needed
- Restart services after changes

## Verification Steps

After setting up your environment:

1. **Test database connection:**
   ```bash
   psql $DATABASE_URL -c "SELECT version();"
   ```

2. **Verify application starts:**
   ```bash
   npm run build
   npm start
   ```

3. **Check web interface:**
   ```bash
   curl http://localhost:5000/api/videos
   ```

4. **Test RTMP server:**
   ```bash
   ffmpeg -re -i test.mp4 -c copy -f flv rtmp://localhost:1935/live/test
   ```

## Support

If you encounter issues:
1. Check the application logs
2. Verify all required services are running
3. Ensure firewall rules are configured
4. Test individual components (database, RTMP, etc.)

Remember to backup your environment file and keep your secrets secure!