#!/bin/bash

# ========================================
# Video Streaming Application Setup Script
# ========================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
print_header() {
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}$1${NC}"
    echo -e "${GREEN}========================================${NC}"
}

print_step() {
    echo -e "${YELLOW}➤ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root"
   exit 1
fi

print_header "Video Streaming Application Setup"

# Detect OS
if [[ -f /etc/os-release ]]; then
    . /etc/os-release
    OS=$ID
    VER=$VERSION_ID
else
    print_error "Cannot detect OS version"
    exit 1
fi

print_step "Detected OS: $OS $VER"

# Update system
print_step "Updating system packages..."
if [[ "$OS" == "ubuntu" ]] || [[ "$OS" == "debian" ]]; then
    sudo apt update && sudo apt upgrade -y
elif [[ "$OS" == "centos" ]] || [[ "$OS" == "rhel" ]] || [[ "$OS" == "fedora" ]]; then
    sudo dnf update -y
fi
print_success "System updated"

# Install Node.js 18
print_step "Installing Node.js 18..."
if [[ "$OS" == "ubuntu" ]] || [[ "$OS" == "debian" ]]; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
elif [[ "$OS" == "centos" ]] || [[ "$OS" == "rhel" ]] || [[ "$OS" == "fedora" ]]; then
    curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
    sudo dnf install -y nodejs
fi
print_success "Node.js installed: $(node --version)"

# Install PostgreSQL
print_step "Installing PostgreSQL..."
if [[ "$OS" == "ubuntu" ]] || [[ "$OS" == "debian" ]]; then
    sudo apt install -y postgresql postgresql-contrib
elif [[ "$OS" == "centos" ]] || [[ "$OS" == "rhel" ]] || [[ "$OS" == "fedora" ]]; then
    sudo dnf install -y postgresql postgresql-server postgresql-contrib
    sudo postgresql-setup --initdb
fi

sudo systemctl enable postgresql
sudo systemctl start postgresql
print_success "PostgreSQL installed and started"

# Install FFmpeg
print_step "Installing FFmpeg..."
if [[ "$OS" == "ubuntu" ]] || [[ "$OS" == "debian" ]]; then
    sudo apt install -y ffmpeg
elif [[ "$OS" == "centos" ]] || [[ "$OS" == "rhel" ]] || [[ "$OS" == "fedora" ]]; then
    sudo dnf install -y epel-release
    sudo dnf install -y ffmpeg
fi
print_success "FFmpeg installed: $(ffmpeg -version | head -n1)"

# Install Nginx with RTMP module
print_step "Installing Nginx with RTMP module..."
if [[ "$OS" == "ubuntu" ]] || [[ "$OS" == "debian" ]]; then
    sudo apt install -y nginx libnginx-mod-rtmp
elif [[ "$OS" == "centos" ]] || [[ "$OS" == "rhel" ]] || [[ "$OS" == "fedora" ]]; then
    sudo dnf install -y nginx nginx-mod-rtmp
fi
print_success "Nginx with RTMP module installed"

# Setup database
print_step "Setting up database..."
DB_PASSWORD=$(openssl rand -base64 32)
sudo -u postgres psql -c "CREATE DATABASE streaming_app;"
sudo -u postgres psql -c "CREATE USER streaming_user WITH ENCRYPTED PASSWORD '$DB_PASSWORD';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE streaming_app TO streaming_user;"
print_success "Database created with user streaming_user"

# Create application user
print_step "Creating application user..."
sudo useradd -r -s /bin/false -m streaming || true
sudo mkdir -p /opt/streaming-app
sudo chown streaming:streaming /opt/streaming-app
print_success "Application user created"

# Create directories
print_step "Creating directories..."
sudo mkdir -p /var/www/html/hls
sudo mkdir -p /opt/streaming-app/uploads
sudo mkdir -p /opt/streaming-app/logs
sudo chown -R streaming:streaming /opt/streaming-app
sudo chown -R www-data:www-data /var/www/html/hls
print_success "Directories created"

# Create environment file
print_step "Creating environment file..."
cat > /tmp/streaming-app.env << EOF
DATABASE_URL=postgresql://streaming_user:$DB_PASSWORD@localhost:5432/streaming_app
PGHOST=localhost
PGPORT=5432
PGDATABASE=streaming_app
PGUSER=streaming_user
PGPASSWORD=$DB_PASSWORD
NODE_ENV=production
PORT=5000
SESSION_SECRET=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -base64 32)
WEBHOOK_SECRET=$(openssl rand -base64 32)
UPLOAD_PATH=/opt/streaming-app/uploads
LOG_FILE=/opt/streaming-app/logs/app.log
RTMP_PORT=1935
HLS_PATH=/var/www/html/hls
EOF

sudo mv /tmp/streaming-app.env /opt/streaming-app/.env
sudo chown streaming:streaming /opt/streaming-app/.env
sudo chmod 600 /opt/streaming-app/.env
print_success "Environment file created"

# Setup firewall
print_step "Configuring firewall..."
if command -v ufw &> /dev/null; then
    sudo ufw allow 22
    sudo ufw allow 80
    sudo ufw allow 443
    sudo ufw allow 1935
    sudo ufw --force enable
    print_success "UFW firewall configured"
elif command -v firewall-cmd &> /dev/null; then
    sudo systemctl enable firewalld
    sudo systemctl start firewalld
    sudo firewall-cmd --permanent --add-port=80/tcp
    sudo firewall-cmd --permanent --add-port=443/tcp
    sudo firewall-cmd --permanent --add-port=1935/tcp
    sudo firewall-cmd --reload
    print_success "Firewalld configured"
fi

# Install application dependencies
if [[ -f "package.json" ]]; then
    print_step "Installing application dependencies..."
    npm install
    print_success "Dependencies installed"
    
    print_step "Building application..."
    npm run build
    print_success "Application built"
    
    print_step "Running database migrations..."
    npm run db:push
    print_success "Database migrated"
    
    # Copy application files
    print_step "Copying application files..."
    sudo cp -r dist node_modules package*.json /opt/streaming-app/
    sudo chown -R streaming:streaming /opt/streaming-app
    print_success "Application files copied"
fi

# Create systemd service
print_step "Creating systemd service..."
sudo tee /etc/systemd/system/streaming-app.service > /dev/null << EOF
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
ReadWritePaths=/opt/streaming-app/logs
ReadWritePaths=/tmp

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable streaming-app
print_success "Systemd service created"

# Copy nginx configuration
if [[ -f "nginx.conf" ]]; then
    print_step "Configuring Nginx..."
    sudo cp nginx.conf /etc/nginx/nginx.conf
    sudo nginx -t
    sudo systemctl enable nginx
    print_success "Nginx configured"
fi

# Start services
print_step "Starting services..."
sudo systemctl start streaming-app
sudo systemctl start nginx
print_success "Services started"

# Print summary
print_header "Installation Complete!"
echo
echo -e "${GREEN}Application Details:${NC}"
echo "• Web Interface: http://$(curl -s ifconfig.me || echo 'your-server-ip')"
echo "• RTMP Server: rtmp://$(curl -s ifconfig.me || echo 'your-server-ip'):1935/live"
echo "• Database: PostgreSQL running on localhost:5432"
echo "• App Directory: /opt/streaming-app"
echo "• Uploads Directory: /opt/streaming-app/uploads"
echo "• Logs Directory: /opt/streaming-app/logs"
echo
echo -e "${GREEN}Generated Credentials:${NC}"
echo "• Database Password: $DB_PASSWORD"
echo "• Environment File: /opt/streaming-app/.env"
echo
echo -e "${GREEN}Service Management:${NC}"
echo "• Start: sudo systemctl start streaming-app"
echo "• Stop: sudo systemctl stop streaming-app"
echo "• Status: sudo systemctl status streaming-app"
echo "• Logs: sudo journalctl -u streaming-app -f"
echo
echo -e "${GREEN}Next Steps:${NC}"
echo "1. Configure your domain in /etc/nginx/nginx.conf"
echo "2. Set up SSL with: sudo certbot --nginx -d your-domain.com"
echo "3. Test streaming by uploading a video through the web interface"
echo
echo -e "${YELLOW}Important: Save the database password and environment file location!${NC}"