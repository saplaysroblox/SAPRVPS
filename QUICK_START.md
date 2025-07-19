# Sa Plays Roblox Streamer - Quick Start Guide

## 🚀 Quick Installation

### Option 1: Automated Installation (Recommended)
```bash
# Download and run the automated installer
chmod +x install-sa-plays-streamer.sh
./install-sa-plays-streamer.sh
```

### Option 2: Docker Installation (Easiest)
```bash
# Start with Docker Compose
docker-compose up -d --build

# Access the application
open http://localhost:5000
```

### Option 3: Manual Installation
```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env

# Start the application
npm run dev
```

## 🔧 Configuration

### Database Settings
- **Database Name**: `neondb`
- **Username**: `neondb_owner`
- **Password**: `npg_lt4QRoXDb8Pf`
- **Host**: `localhost` (local) or `postgres` (Docker)
- **Port**: `5432`

### Application Settings
- **Web Port**: `5000`
- **RTMP Port**: `1935`
- **Streaming Endpoint**: `rtmp://localhost:1935/live`

## 📱 Access URLs

- **Web Interface**: http://localhost:5000
- **RTMP Streaming**: rtmp://localhost:1935/live
- **HLS Streaming**: http://localhost/hls/stream.m3u8

## 🎯 Quick Setup Steps

1. **Upload Videos**: Use the upload button in the playlist manager
2. **Configure Streaming**: Go to Settings → Stream Configuration
3. **Set Platform**: Choose YouTube, Twitch, Facebook, or Custom
4. **Add Stream Key**: Enter your platform-specific stream key
5. **Start Streaming**: Click "Start Stream" to begin broadcasting

## 🛠️ Management Commands

```bash
# Start application
./start-sa-plays-streamer.sh

# Start with Docker
./start-docker.sh

# Backup database
./backup-database.sh

# Restore database
./restore-database.sh <backup-file>

# Stop Docker services
docker-compose down

# View logs
docker-compose logs -f sa-plays-streamer
```

## 🔐 Default Credentials

The application uses the following default database credentials:
- **Database**: `neondb`
- **User**: `neondb_owner`
- **Password**: `npg_lt4QRoXDb8Pf`

These credentials are pre-configured in all setup files and don't need to be changed.

## 🎮 Features

- **Video Upload & Management**: Upload MP4, AVI, MOV files
- **Playlist Management**: Drag-and-drop reordering
- **24x7 Streaming**: Automatic playlist looping
- **Multi-Platform Support**: YouTube, Twitch, Facebook, Custom RTMP
- **Stream Configuration**: Quality settings, bitrate control
- **System Settings**: RTMP port, web port, database configuration
- **Database Management**: Backup, restore, installation
- **Real-time Status**: Live streaming metrics and viewer counts

## 🚨 Troubleshooting

### Common Issues

1. **Database Connection Failed**
   ```bash
   # Check if PostgreSQL is running
   docker-compose ps
   
   # Restart services
   docker-compose restart
   ```

2. **Port Already in Use**
   ```bash
   # Find process using port 5000
   lsof -i :5000
   
   # Kill the process
   kill -9 <PID>
   ```

3. **FFmpeg Not Found**
   ```bash
   # Install FFmpeg
   sudo apt-get install ffmpeg  # Ubuntu/Debian
   brew install ffmpeg          # macOS
   ```

4. **Stream Not Starting**
   - Check your stream key is correct
   - Verify the RTMP URL is valid
   - Ensure firewall allows port 1935

### Log Files
- Application logs: Check Docker logs with `docker-compose logs`
- Database logs: Check PostgreSQL container logs
- Nginx logs: Located in `/var/log/nginx/`

## 📞 Support

If you encounter issues:
1. Check the logs for error messages
2. Verify all dependencies are installed
3. Ensure proper file permissions
4. Try restarting the services

## 🎉 Ready to Stream!

Your Sa Plays Roblox Streamer is now ready to use. Visit http://localhost:5000 to start managing your videos and streaming to your favorite platforms!