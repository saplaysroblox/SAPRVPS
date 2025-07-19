# Sa Plays Roblox Streamer

A comprehensive video streaming platform built with modern web technologies, designed for seamless video upload, playlist management, and multi-platform streaming to YouTube, Twitch, Facebook, and custom RTMP servers.

## ✨ Features

- **Video Upload & Management**: Upload MP4, AVI, MOV files with drag-and-drop support
- **Playlist Management**: Intuitive drag-and-drop reordering with real-time updates
- **24x7 Streaming**: Automatic playlist looping for continuous broadcasting
- **Multi-Platform Support**: Stream to YouTube, Twitch, Facebook, or custom RTMP servers
- **Advanced Stream Configuration**: Quality settings, bitrate control, and platform-specific optimizations
- **System Configuration**: Customizable RTMP ports, web ports, and database settings
- **Database Management**: Built-in backup, restore, and installation tools
- **Real-time Monitoring**: Live streaming metrics, viewer counts, and uptime tracking
- **Responsive Design**: Modern UI with dark/light mode support

## 🚀 Quick Start

### Option 1: Automated Installation (Recommended)
```bash
# Clone the repository
git clone <repository-url>
cd sa-plays-roblox-streamer

# Run the automated installer
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

# Setup database
npm run db:push

# Start development server
npm run dev
```

## 📋 System Requirements

- **Node.js**: 18.0 or higher
- **PostgreSQL**: 12.0 or higher  
- **FFmpeg**: 4.2 or higher
- **Nginx**: 1.18 or higher (with RTMP module)
- **System Resources**: 2GB RAM, 20GB storage minimum

## 🔧 Configuration

### Database Settings
The application uses the following database configuration:
- **Database Name**: `neondb`
- **Username**: `neondb_owner`
- **Password**: `npg_lt4QRoXDb8Pf`
- **Host**: `localhost` (local) or `postgres` (Docker)
- **Port**: `5432`

### Application Settings
- **Web Port**: `5000`
- **RTMP Port**: `1935`
- **Environment**: Production-ready with Docker support

## 🌐 Access Points

- **Web Interface**: http://localhost:5000
- **RTMP Streaming**: rtmp://localhost:1935/live
- **HLS Streaming**: http://localhost/hls/stream.m3u8

## 🎯 Usage Guide

### 1. Upload Videos
- Navigate to the playlist manager
- Click the upload button or drag-and-drop video files
- Supported formats: MP4, AVI, MOV (max 500MB)

### 2. Configure Streaming
- Go to Settings → Stream Configuration
- Choose your platform (YouTube, Twitch, Facebook, or Custom)
- Enter your platform-specific stream key
- Configure quality settings (resolution, bitrate, frame rate)

### 3. Manage Playlist
- Drag and drop videos to reorder
- Set current video for streaming
- Enable 24x7 loop for continuous broadcasting

### 4. Start Streaming
- Click "Start Stream" to begin broadcasting
- Monitor real-time metrics and viewer counts
- Use "Stop Stream" to end broadcasting

## 🛠️ Management Commands

### Application Control
```bash
# Start application (local)
./start-sa-plays-streamer.sh

# Start with Docker
./start-docker.sh

# Stop Docker services
docker-compose down

# View logs
docker-compose logs -f sa-plays-streamer
```

### Database Management
```bash
# Backup database
./backup-database.sh

# Restore database
./restore-database.sh <backup-file>

# Reset database
npm run db:push
```

### Development
```bash
# Start development server
npm run dev

# Build production version
npm run build

# Start production server
npm start
```

## 🏗️ Architecture

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and builds
- **Tailwind CSS** for styling
- **Radix UI** components with shadcn/ui
- **React Query** for server state management
- **Wouter** for routing

### Backend
- **Node.js** with Express.js
- **PostgreSQL** with Drizzle ORM
- **FFmpeg** for video processing
- **Nginx** with RTMP module for streaming
- **TypeScript** throughout

### Infrastructure
- **Docker** containerization
- **Docker Compose** orchestration
- **PostgreSQL** database
- **Redis** for caching (optional)
- **Nginx** reverse proxy

## 📁 Project Structure

```
sa-plays-roblox-streamer/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Application pages
│   │   └── lib/           # Utilities and hooks
├── server/                 # Express backend
│   ├── routes.ts          # API routes
│   ├── db.ts              # Database connection
│   ├── storage.ts         # Data layer
│   └── rtmp.ts            # RTMP streaming
├── shared/                 # Shared types and schemas
├── uploads/               # Video file storage
├── backups/               # Database backups
├── docker-compose.yml     # Docker orchestration
├── Dockerfile            # Container configuration
├── install-sa-plays-streamer.sh  # Automated installer
└── README.md             # This file
```

## 🔐 Security

- Environment variables for sensitive data
- PostgreSQL with authentication
- Session-based authentication
- CORS protection
- Input validation with Zod
- File upload restrictions

## 🚨 Troubleshooting

### Common Issues

1. **Database Connection Error**
   ```bash
   # Check PostgreSQL status
   docker-compose ps
   
   # Restart database
   docker-compose restart postgres
   ```

2. **Port Already in Use**
   ```bash
   # Find process using port
   lsof -i :5000
   
   # Kill process
   kill -9 <PID>
   ```

3. **FFmpeg Not Found**
   ```bash
   # Install FFmpeg
   sudo apt-get install ffmpeg    # Ubuntu/Debian
   brew install ffmpeg           # macOS
   ```

4. **Stream Not Starting**
   - Verify stream key is correct
   - Check RTMP URL format
   - Ensure port 1935 is open
   - Check FFmpeg logs for errors

### Log Files
- **Application**: `docker-compose logs sa-plays-streamer`
- **Database**: `docker-compose logs postgres`
- **Nginx**: `/var/log/nginx/error.log`

## 📈 Performance

- **Concurrent Streams**: Supports multiple simultaneous streams
- **Video Processing**: Hardware-accelerated when available
- **Database**: Optimized queries with proper indexing
- **Caching**: Redis for session and API response caching
- **CDN Ready**: Static assets optimized for CDN deployment

## 🔄 Updates

To update the application:
```bash
# Pull latest changes
git pull origin main

# Update dependencies
npm install

# Rebuild Docker images
docker-compose up -d --build

# Run database migrations
npm run db:push
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🎉 Ready to Stream!

Your Sa Plays Roblox Streamer is now ready to use. Visit http://localhost:5000 to start managing your videos and streaming to your favorite platforms!

---

For detailed deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md).
For quick setup guide, see [QUICK_START.md](QUICK_START.md).