# Sa Plays Roblox Streamer - Deployment Guide

This guide explains how to deploy the Sa Plays Roblox Streamer application to your own servers.

## Prerequisites

### System Requirements
- Ubuntu 20.04+ or CentOS 8+ (recommended)
- Node.js 18+ and npm
- PostgreSQL 12+
- FFmpeg 4.2+
- Nginx with RTMP module
- At least 2GB RAM and 20GB storage

### Required Software Installation

#### Ubuntu/Debian
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib -y

# Install FFmpeg
sudo apt install ffmpeg -y

# Install Nginx with RTMP module
sudo apt install nginx libnginx-mod-rtmp -y
```

#### CentOS/RHEL
```bash
# Update system
sudo dnf update -y

# Install Node.js 18
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo dnf install -y nodejs

# Install PostgreSQL
sudo dnf install postgresql postgresql-server postgresql-contrib -y
sudo postgresql-setup --initdb
sudo systemctl enable postgresql
sudo systemctl start postgresql

# Install FFmpeg
sudo dnf install epel-release -y
sudo dnf install ffmpeg -y

# Install Nginx with RTMP module
sudo dnf install nginx nginx-mod-rtmp -y
```

## Database Setup

### PostgreSQL Configuration
```bash
# Switch to postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE streaming_app;
CREATE USER streaming_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE streaming_app TO streaming_user;
\q
```

### Environment Variables
Create a `.env` file in the project root:
```env
DATABASE_URL=postgresql://streaming_user:your_secure_password@localhost:5432/streaming_app
NODE_ENV=production
PORT=5000
```

## Application Deployment

### 1. Clone and Setup Application
```bash
# Clone your repository
git clone <your-repo-url>
cd video-streaming-app

# Install dependencies
npm install

# Build the application
npm run build

# Initialize database
npm run db:push
```

### 2. Create System User
```bash
# Create dedicated user for the application
sudo useradd -r -s /bin/false streaming
sudo mkdir -p /opt/streaming-app
sudo chown streaming:streaming /opt/streaming-app
```

### 3. Copy Application Files
```bash
# Copy files to production directory
sudo cp -r * /opt/streaming-app/
sudo chown -R streaming:streaming /opt/streaming-app
sudo chmod +x /opt/streaming-app/server/index.js
```

### 4. Create Systemd Service
Create `/etc/systemd/system/streaming-app.service`:
```ini
[Unit]
Description=Video Streaming Application
After=network.target postgresql.service

[Service]
Type=simple
User=streaming
WorkingDirectory=/opt/streaming-app
ExecStart=/usr/bin/node dist/server/index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
EnvironmentFile=/opt/streaming-app/.env

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/opt/streaming-app/uploads
ReadWritePaths=/tmp

[Install]
WantedBy=multi-user.target
```

### 5. Start Application Service
```bash
# Reload systemd and start service
sudo systemctl daemon-reload
sudo systemctl enable streaming-app
sudo systemctl start streaming-app

# Check status
sudo systemctl status streaming-app
```

## Nginx Configuration

### 1. Main Nginx Configuration
Replace `/etc/nginx/nginx.conf` with:
```nginx
user www-data;
worker_processes auto;
pid /run/nginx.pid;
error_log /var/log/nginx/error.log;

events {
    worker_connections 1024;
    use epoll;
    multi_accept on;
}

# Load RTMP module
load_module modules/ngx_rtmp_module.so;

# RTMP configuration
rtmp {
    server {
        listen 1935;
        chunk_size 4096;
        
        # Live streaming application
        application live {
            live on;
            record off;
            
            # Security: Allow publishing from localhost only
            allow publish 127.0.0.1;
            deny publish all;
            
            # Allow all to play
            allow play all;
            
            # HLS configuration
            hls on;
            hls_path /var/www/html/hls;
            hls_fragment 3;
            hls_playlist_length 60;
            hls_sync 100ms;
            hls_continuous on;
            
            # Webhooks
            on_publish http://localhost:5000/api/rtmp/publish;
            on_play http://localhost:5000/api/rtmp/play;
            on_publish_done http://localhost:5000/api/rtmp/publish_done;
            on_play_done http://localhost:5000/api/rtmp/play_done;
        }
    }
}

# HTTP configuration
http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    # Logging
    access_log /var/log/nginx/access.log;
    
    # Basic settings
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json;
    
    server {
        listen 80;
        server_name your-domain.com;
        
        # Static files
        location / {
            proxy_pass http://localhost:5000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }
        
        # File uploads
        location /uploads {
            alias /opt/streaming-app/uploads;
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
        
        # HLS streaming
        location /hls {
            types {
                application/vnd.apple.mpegurl m3u8;
                video/mp2t ts;
            }
            root /var/www/html;
            add_header Cache-Control no-cache;
            add_header Access-Control-Allow-Origin *;
        }
        
        # RTMP statistics
        location /stat {
            rtmp_stat all;
            rtmp_stat_stylesheet stat.xsl;
            add_header Access-Control-Allow-Origin *;
        }
    }
}
```

### 2. Create Required Directories
```bash
# Create HLS directory
sudo mkdir -p /var/www/html/hls
sudo chown -R www-data:www-data /var/www/html/hls

# Create uploads directory
sudo mkdir -p /opt/streaming-app/uploads
sudo chown -R streaming:streaming /opt/streaming-app/uploads
```

### 3. Start Nginx
```bash
# Test configuration
sudo nginx -t

# Start Nginx
sudo systemctl enable nginx
sudo systemctl start nginx
sudo systemctl status nginx
```

## SSL/HTTPS Setup (Recommended)

### Using Let's Encrypt
```bash
# Install Certbot
sudo apt install snapd -y
sudo snap install --classic certbot

# Generate SSL certificate
sudo certbot --nginx -d your-domain.com

# Test renewal
sudo certbot renew --dry-run
```

### Update Nginx for HTTPS
Add to your server block:
```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    # SSL settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # ... rest of configuration
}
```

## Firewall Configuration

### UFW (Ubuntu)
```bash
# Enable firewall
sudo ufw enable

# Allow SSH
sudo ufw allow 22

# Allow HTTP/HTTPS
sudo ufw allow 80
sudo ufw allow 443

# Allow RTMP
sudo ufw allow 1935

# Check status
sudo ufw status
```

### Firewalld (CentOS)
```bash
# Enable firewall
sudo systemctl enable firewalld
sudo systemctl start firewalld

# Allow ports
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --permanent --add-port=443/tcp
sudo firewall-cmd --permanent --add-port=1935/tcp
sudo firewall-cmd --reload
```

## Monitoring and Logs

### Application Logs
```bash
# View application logs
sudo journalctl -u streaming-app -f

# View Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Health Checks
Create a simple health check script:
```bash
#!/bin/bash
# /opt/streaming-app/health-check.sh

# Check if application is running
if ! curl -f http://localhost:5000/api/videos > /dev/null 2>&1; then
    echo "Application is down, restarting..."
    sudo systemctl restart streaming-app
fi

# Check if Nginx is running
if ! systemctl is-active --quiet nginx; then
    echo "Nginx is down, restarting..."
    sudo systemctl restart nginx
fi
```

Add to crontab:
```bash
# Run health check every 5 minutes
*/5 * * * * /opt/streaming-app/health-check.sh
```

## Performance Optimization

### Node.js Process Management
Consider using PM2 for better process management:
```bash
# Install PM2
sudo npm install -g pm2

# Start application with PM2
pm2 start dist/server/index.js --name streaming-app

# Save PM2 configuration
pm2 save
pm2 startup
```

### Database Optimization
Add to PostgreSQL configuration:
```sql
-- /etc/postgresql/12/main/postgresql.conf
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
```

## Backup Strategy

### Database Backup
```bash
#!/bin/bash
# Create daily database backup
pg_dump streaming_app > /backups/streaming_app_$(date +%Y%m%d).sql

# Keep only last 7 days
find /backups -name "streaming_app_*.sql" -mtime +7 -delete
```

### Application Backup
```bash
#!/bin/bash
# Backup uploads directory
tar -czf /backups/uploads_$(date +%Y%m%d).tar.gz /opt/streaming-app/uploads/
```

## Troubleshooting

### Common Issues

1. **Application won't start**
   - Check logs: `sudo journalctl -u streaming-app`
   - Verify database connection
   - Check file permissions

2. **RTMP streaming fails**
   - Verify FFmpeg installation: `ffmpeg -version`
   - Check Nginx RTMP module: `nginx -V`
   - Review firewall settings

3. **Database connection issues**
   - Check PostgreSQL status: `sudo systemctl status postgresql`
   - Verify database credentials
   - Test connection: `psql -h localhost -U streaming_user -d streaming_app`

### Performance Issues
- Monitor system resources: `htop`, `iotop`
- Check database performance: `EXPLAIN ANALYZE` queries
- Review Nginx access logs for slow requests

## Security Considerations

1. **Database Security**
   - Use strong passwords
   - Limit database access to localhost
   - Regular security updates

2. **Application Security**
   - Keep dependencies updated
   - Use HTTPS everywhere
   - Implement rate limiting

3. **Server Security**
   - Regular OS updates
   - Fail2ban for brute force protection
   - Disable unnecessary services

## Updates and Maintenance

### Application Updates
```bash
# Pull latest code
git pull origin main

# Install dependencies
npm install

# Build application
npm run build

# Run migrations
npm run db:push

# Restart service
sudo systemctl restart streaming-app
```

### System Updates
```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Restart services if needed
sudo systemctl restart streaming-app
sudo systemctl restart nginx
```

This deployment guide provides a complete setup for running your video streaming application on your own servers with proper security, monitoring, and backup strategies.