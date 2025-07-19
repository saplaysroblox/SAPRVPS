#!/bin/bash

# Sa Plays Roblox Streamer - Automated Installation Script
# This script sets up the complete streaming application with all dependencies

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration - Using current database credentials
DB_NAME="neondb"
DB_USER="neondb_owner"
DB_PASSWORD="npg_lt4QRoXDb8Pf"
DB_HOST="localhost"
DB_PORT="5432"
APP_PORT="5000"
RTMP_PORT="1935"

print_header() {
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE}   Sa Plays Roblox Streamer - Installation${NC}"
    echo -e "${BLUE}================================================${NC}"
    echo ""
}

print_step() {
    echo -e "${GREEN}[STEP]${NC} $1"
}

print_info() {
    echo -e "${YELLOW}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_command() {
    if ! command -v $1 &> /dev/null; then
        print_error "$1 is not installed"
        return 1
    fi
    return 0
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root"
   exit 1
fi

print_header

# Step 1: Check system requirements
print_step "Checking system requirements..."
MISSING_DEPS=()

if ! check_command "node"; then
    MISSING_DEPS+=("nodejs")
fi

if ! check_command "npm"; then
    MISSING_DEPS+=("npm")
fi

if ! check_command "docker"; then
    MISSING_DEPS+=("docker")
fi

if ! check_command "docker-compose"; then
    MISSING_DEPS+=("docker-compose")
fi

if ! check_command "git"; then
    MISSING_DEPS+=("git")
fi

if [ ${#MISSING_DEPS[@]} -ne 0 ]; then
    print_error "Missing required dependencies: ${MISSING_DEPS[*]}"
    print_info "Please install the missing dependencies and run this script again"
    exit 1
fi

print_info "All system requirements met"

# Step 2: Install system dependencies
print_step "Installing system dependencies..."

# Detect OS
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    if command -v apt-get &> /dev/null; then
        print_info "Installing dependencies for Ubuntu/Debian..."
        sudo apt-get update
        sudo apt-get install -y \
            ffmpeg \
            nginx \
            postgresql-client \
            curl \
            wget \
            unzip \
            build-essential \
            python3 \
            python3-pip
    elif command -v yum &> /dev/null; then
        print_info "Installing dependencies for CentOS/RHEL..."
        sudo yum install -y \
            ffmpeg \
            nginx \
            postgresql \
            curl \
            wget \
            unzip \
            gcc \
            gcc-c++ \
            make \
            python3 \
            python3-pip
    else
        print_error "Unsupported Linux distribution"
        exit 1
    fi
elif [[ "$OSTYPE" == "darwin"* ]]; then
    print_info "Installing dependencies for macOS..."
    if ! command -v brew &> /dev/null; then
        print_error "Homebrew is required for macOS installation"
        print_info "Install Homebrew from https://brew.sh/"
        exit 1
    fi
    brew install ffmpeg nginx postgresql curl wget
else
    print_error "Unsupported operating system: $OSTYPE"
    exit 1
fi

# Step 3: Setup project directory
print_step "Setting up project directory..."
PROJECT_DIR="$HOME/sa-plays-roblox-streamer"
if [ -d "$PROJECT_DIR" ]; then
    print_info "Project directory already exists. Backing up..."
    mv "$PROJECT_DIR" "$PROJECT_DIR.backup.$(date +%Y%m%d_%H%M%S)"
fi

mkdir -p "$PROJECT_DIR"
cd "$PROJECT_DIR"

# Step 4: Clone or setup application files
print_step "Setting up application files..."
if [ -f "package.json" ]; then
    print_info "Using existing application files"
else
    print_info "Creating application structure..."
    mkdir -p client/src server shared uploads backups
fi

# Step 5: Create environment files
print_step "Creating environment configuration..."

# Create .env file
cat > .env << EOF
# Sa Plays Roblox Streamer Configuration
NODE_ENV=production
PORT=${APP_PORT}

# Database Configuration
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}
PGHOST=${DB_HOST}
PGPORT=${DB_PORT}
PGUSER=${DB_USER}
PGPASSWORD=${DB_PASSWORD}
PGDATABASE=${DB_NAME}

# Application Settings
RTMP_PORT=${RTMP_PORT}
WEB_PORT=${APP_PORT}

# Security (generate new values for production)
SESSION_SECRET=sa-plays-roblox-streamer-secret-key-$(date +%s)
JWT_SECRET=sa-plays-jwt-secret-$(date +%s)
EOF

# Create .env.production file
cat > .env.production << EOF
# Sa Plays Roblox Streamer Production Configuration
NODE_ENV=production
PORT=${APP_PORT}

# Database Configuration
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}
PGHOST=postgres
PGPORT=5432
PGUSER=${DB_USER}
PGPASSWORD=${DB_PASSWORD}
PGDATABASE=${DB_NAME}

# Application Settings
RTMP_PORT=${RTMP_PORT}
WEB_PORT=${APP_PORT}

# Security
SESSION_SECRET=sa-plays-roblox-streamer-production-secret
JWT_SECRET=sa-plays-jwt-production-secret
EOF

# Create Docker environment file
cat > .env.docker << EOF
# Sa Plays Roblox Streamer Docker Configuration
POSTGRES_PASSWORD=${DB_PASSWORD}
POSTGRES_USER=${DB_USER}
POSTGRES_DB=${DB_NAME}
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}
EOF

# Step 6: Install Node.js dependencies
print_step "Installing Node.js dependencies..."
if [ -f "package.json" ]; then
    npm install
else
    print_info "Initializing npm project..."
    npm init -y
    npm install \
        express \
        @neondatabase/serverless \
        drizzle-orm \
        drizzle-kit \
        pg \
        react \
        react-dom \
        @types/node \
        @types/express \
        @types/pg \
        typescript \
        vite \
        @vitejs/plugin-react \
        tailwindcss \
        autoprefixer \
        postcss
fi

# Step 7: Setup database
print_step "Setting up database..."
if command -v psql &> /dev/null; then
    print_info "Creating local PostgreSQL database..."
    
    # Check if PostgreSQL is running
    if ! pgrep -x "postgres" > /dev/null; then
        print_info "Starting PostgreSQL service..."
        if [[ "$OSTYPE" == "linux-gnu"* ]]; then
            sudo systemctl start postgresql
            sudo systemctl enable postgresql
        elif [[ "$OSTYPE" == "darwin"* ]]; then
            brew services start postgresql
        fi
    fi
    
    # Create database and user
    sudo -u postgres psql -c "CREATE DATABASE IF NOT EXISTS ${DB_NAME};" || true
    sudo -u postgres psql -c "CREATE USER IF NOT EXISTS ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';" || true
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};" || true
    
    print_info "Database setup completed"
else
    print_info "PostgreSQL client not found. Using Docker database setup."
fi

# Step 8: Create systemd service (Linux only)
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    print_step "Creating systemd service..."
    
    sudo tee /etc/systemd/system/sa-plays-streamer.service > /dev/null << EOF
[Unit]
Description=Sa Plays Roblox Streamer
After=network.target postgresql.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$PROJECT_DIR
Environment=NODE_ENV=production
EnvironmentFile=$PROJECT_DIR/.env
ExecStart=/usr/bin/npm start
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    sudo systemctl daemon-reload
    sudo systemctl enable sa-plays-streamer
    print_info "Systemd service created and enabled"
fi

# Step 9: Setup nginx configuration
print_step "Setting up nginx configuration..."
sudo tee /etc/nginx/sites-available/sa-plays-streamer > /dev/null << EOF
server {
    listen 80;
    server_name _;
    
    # Serve static files
    location / {
        proxy_pass http://localhost:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
    
    # API routes
    location /api {
        proxy_pass http://localhost:${APP_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
    
    # HLS streaming
    location /hls {
        add_header Cache-Control no-cache;
        add_header Access-Control-Allow-Origin *;
        root /var/www/html;
    }
}

# RTMP server configuration
rtmp {
    server {
        listen ${RTMP_PORT};
        chunk_size 4096;
        
        application live {
            live on;
            record off;
            
            # HLS settings
            hls on;
            hls_path /var/www/html/hls;
            hls_fragment 3;
            hls_playlist_length 60;
            
            # Authentication
            allow publish all;
            allow play all;
        }
    }
}
EOF

# Enable the site
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    sudo ln -sf /etc/nginx/sites-available/sa-plays-streamer /etc/nginx/sites-enabled/
    sudo nginx -t
    sudo systemctl restart nginx
    print_info "Nginx configuration updated"
fi

# Step 10: Create startup script
print_step "Creating startup script..."
cat > start-sa-plays-streamer.sh << 'EOF'
#!/bin/bash

# Sa Plays Roblox Streamer Startup Script
echo "Starting Sa Plays Roblox Streamer..."

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | xargs)
fi

# Check if database is ready
echo "Checking database connection..."
until pg_isready -h $PGHOST -U $PGUSER -d $PGDATABASE; do
    echo "Waiting for database..."
    sleep 2
done

# Run database migrations
echo "Running database migrations..."
npm run db:push

# Start the application
echo "Starting application on port $PORT..."
npm start
EOF

chmod +x start-sa-plays-streamer.sh

# Step 11: Create Docker startup script
print_step "Creating Docker startup script..."
cat > start-docker.sh << 'EOF'
#!/bin/bash

# Sa Plays Roblox Streamer Docker Startup Script
echo "Starting Sa Plays Roblox Streamer with Docker..."

# Pull latest images
docker-compose pull

# Build and start services
docker-compose up -d --build

# Wait for services to be ready
echo "Waiting for services to start..."
sleep 10

# Check service status
docker-compose ps

echo "Sa Plays Roblox Streamer is now running!"
echo "Access the application at: http://localhost:5000"
echo "RTMP streaming endpoint: rtmp://localhost:1935/live"
EOF

chmod +x start-docker.sh

# Step 12: Create management scripts
print_step "Creating management scripts..."

# Backup script
cat > backup-database.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="./backups"
mkdir -p $BACKUP_DIR
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/sa-plays-streamer-backup-$TIMESTAMP.sql"

echo "Creating database backup..."
pg_dump -h $PGHOST -U $PGUSER -d $PGDATABASE > $BACKUP_FILE
echo "Backup created: $BACKUP_FILE"
EOF

# Restore script
cat > restore-database.sh << 'EOF'
#!/bin/bash
if [ -z "$1" ]; then
    echo "Usage: $0 <backup-file>"
    exit 1
fi

echo "Restoring database from $1..."
psql -h $PGHOST -U $PGUSER -d $PGDATABASE < $1
echo "Database restored successfully"
EOF

chmod +x backup-database.sh restore-database.sh

# Step 13: Final setup
print_step "Completing installation..."

# Create required directories
mkdir -p uploads backups

# Set proper permissions
chmod 755 uploads backups

print_step "Installation completed successfully!"
echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}   Sa Plays Roblox Streamer Installation Complete${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
echo -e "${YELLOW}Application Details:${NC}"
echo "• Project Directory: $PROJECT_DIR"
echo "• Database: $DB_NAME"
echo "• Database User: $DB_USER"
echo "• Application Port: $APP_PORT"
echo "• RTMP Port: $RTMP_PORT"
echo ""
echo -e "${YELLOW}Available Commands:${NC}"
echo "• Start Application: ./start-sa-plays-streamer.sh"
echo "• Start with Docker: ./start-docker.sh"
echo "• Backup Database: ./backup-database.sh"
echo "• Restore Database: ./restore-database.sh <backup-file>"
echo ""
echo -e "${YELLOW}Access URLs:${NC}"
echo "• Web Interface: http://localhost:$APP_PORT"
echo "• RTMP Streaming: rtmp://localhost:$RTMP_PORT/live"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "1. cd $PROJECT_DIR"
echo "2. ./start-sa-plays-streamer.sh (for local installation)"
echo "   OR ./start-docker.sh (for Docker installation)"
echo "3. Open http://localhost:$APP_PORT in your browser"
echo ""
echo -e "${GREEN}Happy Streaming!${NC}"