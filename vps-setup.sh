#!/bin/bash

# Pegasus Nest API - VPS Production Deployment Script
# This script sets up the complete production environment on a Linux VPS

set -e  # Exit on any error

# Configuration
DOMAIN_NAME="yourdomain.com"  # Replace with your actual domain
API_SUBDOMAIN="api"
UI_SUBDOMAIN="app"
EMAIL_FOR_SSL="your-email@domain.com"  # Replace with your email for SSL certificates
OPENROUTER_API_KEY="your_openrouter_api_key_here"  # Replace with your actual API key

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_step() {
    echo -e "${BLUE}🔧 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        print_error "This script should not be run as root. Please run as a regular user with sudo privileges."
        exit 1
    fi
}

# Collect configuration
collect_config() {
    echo -e "${BLUE}🚀 Pegasus Nest API - VPS Production Setup${NC}"
    echo "This script will set up your complete production environment."
    echo ""
    
    if [[ -z "$DOMAIN_NAME" ]]; then
        read -p "Enter your domain name (e.g., yourdomain.com): " DOMAIN_NAME
    fi
    
    if [[ -z "$EMAIL_FOR_SSL" ]]; then
        read -p "Enter your email for SSL certificates: " EMAIL_FOR_SSL
    fi
    
    if [[ -z "$OPENROUTER_API_KEY" ]]; then
        read -p "Enter your OpenRouter API key: " OPENROUTER_API_KEY
    fi
    
    echo ""
    echo "Configuration:"
    echo "  Domain: $DOMAIN_NAME"
    echo "  API URL: https://$API_SUBDOMAIN.$DOMAIN_NAME"
    echo "  UI URL: https://$UI_SUBDOMAIN.$DOMAIN_NAME"
    echo "  Email: $EMAIL_FOR_SSL"
    echo ""
    
    read -p "Proceed with this configuration? (y/N): " confirm
    if [[ $confirm != [yY] ]]; then
        echo "Setup cancelled."
        exit 0
    fi
}

# Install system dependencies
install_dependencies() {
    print_step "Installing system dependencies..."
    
    # Update system
    sudo apt update && sudo apt upgrade -y
    
    # Install required packages
    sudo apt install -y \
        curl \
        wget \
        git \
        ufw \
        fail2ban \
        htop \
        nano \
        unzip \
        software-properties-common \
        apt-transport-https \
        ca-certificates \
        gnupg \
        lsb-release
    
    print_success "System dependencies installed"
}

# Install Docker
install_docker() {
    print_step "Installing Docker..."
    
    # Check if Docker is already installed
    if command -v docker &> /dev/null; then
        print_warning "Docker is already installed"
        return
    fi
    
    # Add Docker's official GPG key
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    
    # Set up stable repository
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Install Docker
    sudo apt update
    sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    
    # Add user to docker group
    sudo usermod -aG docker $USER
    
    print_success "Docker installed"
}

# Install Docker Compose
install_docker_compose() {
    print_step "Installing Docker Compose..."
    
    # Check if docker compose is available
    if docker compose version &> /dev/null; then
        print_warning "Docker Compose is already installed"
        return
    fi
    
    # Install docker-compose (standalone)
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    
    print_success "Docker Compose installed"
}

# Install Certbot for SSL
install_certbot() {
    print_step "Installing Certbot for SSL certificates..."
    
    sudo apt install -y certbot python3-certbot-nginx
    
    print_success "Certbot installed"
}

# Setup firewall
setup_firewall() {
    print_step "Setting up firewall..."
    
    # Reset UFW to defaults
    sudo ufw --force reset
    
    # Default policies
    sudo ufw default deny incoming
    sudo ufw default allow outgoing
    
    # Allow SSH (adjust port if you've changed it)
    sudo ufw allow ssh
    
    # Allow HTTP and HTTPS
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
    
    # Enable firewall
    sudo ufw --force enable
    
    print_success "Firewall configured"
}

# Setup fail2ban
setup_fail2ban() {
    print_step "Setting up Fail2Ban..."
    
    # Create local jail configuration
    sudo tee /etc/fail2ban/jail.local > /dev/null <<EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3

[sshd]
enabled = true
port = ssh
logpath = /var/log/auth.log

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
logpath = /var/log/nginx/error.log

[nginx-noscript]
enabled = true
port = http,https
filter = nginx-noscript
logpath = /var/log/nginx/access.log
maxretry = 6

[nginx-badbots]
enabled = true
port = http,https
filter = nginx-badbots
logpath = /var/log/nginx/access.log
maxretry = 2
EOF

    sudo systemctl enable fail2ban
    sudo systemctl start fail2ban
    
    print_success "Fail2Ban configured"
}

# Create application directory and environment
setup_app_environment() {
    print_step "Setting up application environment..."
    
    # Create app directory
    sudo mkdir -p /opt/pegasus-nest
    sudo chown $USER:$USER /opt/pegasus-nest
    
    # Create environment file
    cat > /opt/pegasus-nest/.env.production <<EOF
# Production Environment Configuration
NODE_ENV=production

# OpenRouter API Configuration
OPENROUTER_API_KEY=$OPENROUTER_API_KEY

# Server Configuration
PORT=3000

# Site Configuration
SITE_URL=https://$API_SUBDOMAIN.$DOMAIN_NAME
SITE_NAME=Pegasus API

# AI Configuration
AI_FIXING_ENABLED=true
AUTO_FIX_ENABLED=true

# Performance Settings
DEBUG_AI_PROMPTS=false

# CORS Configuration
ALLOWED_ORIGINS=https://$UI_SUBDOMAIN.$DOMAIN_NAME,https://$DOMAIN_NAME
EOF
    
    # Set proper permissions
    chmod 600 /opt/pegasus-nest/.env.production
    
    print_success "Application environment created"
}

# Generate SSL certificates
generate_ssl_certificates() {
    print_step "Generating SSL certificates..."
    
    # Stop nginx if running
    sudo systemctl stop nginx 2>/dev/null || true
    
    # Generate certificates for both subdomains
    sudo certbot certonly --standalone \
        --email $EMAIL_FOR_SSL \
        --agree-tos \
        --no-eff-email \
        -d $API_SUBDOMAIN.$DOMAIN_NAME \
        -d $UI_SUBDOMAIN.$DOMAIN_NAME
    
    print_success "SSL certificates generated"
}

# Create deployment script
create_deployment_script() {
    print_step "Creating deployment script..."
    
    cat > /opt/pegasus-nest/deploy.sh <<'EOF'
#!/bin/bash

# Pegasus Nest API - Production Deployment Script

set -e

APP_DIR="/opt/pegasus-nest"
BACKUP_DIR="/opt/pegasus-nest/backups"

print_step() {
    echo -e "\033[0;34m🔧 $1\033[0m"
}

print_success() {
    echo -e "\033[0;32m✅ $1\033[0m"
}

print_step "Starting deployment..."

# Create backup directory
mkdir -p $BACKUP_DIR

# Create backup if app exists
if [ -d "$APP_DIR/pegasus_nest" ]; then
    print_step "Creating backup..."
    tar -czf "$BACKUP_DIR/backup-$(date +%Y%m%d-%H%M%S).tar.gz" -C "$APP_DIR" pegasus_nest
fi

# Navigate to app directory
cd $APP_DIR

# Pull latest code (if using git)
if [ -d ".git" ]; then
    print_step "Pulling latest code..."
    git pull origin main
fi

# Stop existing containers
print_step "Stopping existing containers..."
docker compose -f docker-compose.prod.yml down || true

# Build and start new containers
print_step "Building and starting containers..."
docker compose -f docker-compose.prod.yml --env-file .env.production up --build -d

# Wait for health check
print_step "Waiting for health check..."
sleep 15

# Check if API is healthy
if curl -f -s http://localhost:3000/health > /dev/null; then
    print_success "Deployment successful!"
    print_success "API is healthy and running"
else
    echo "❌ Health check failed!"
    docker compose -f docker-compose.prod.yml logs
    exit 1
fi

# Cleanup old images
print_step "Cleaning up old Docker images..."
docker image prune -f

print_success "Deployment complete!"
EOF

    chmod +x /opt/pegasus-nest/deploy.sh
    
    print_success "Deployment script created"
}

# Create systemd service for auto-start
create_systemd_service() {
    print_step "Creating systemd service..."
    
    sudo tee /etc/systemd/system/pegasus-nest.service > /dev/null <<EOF
[Unit]
Description=Pegasus Nest API
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/pegasus-nest
ExecStart=/usr/bin/docker compose -f docker-compose.prod.yml --env-file .env.production up -d
ExecStop=/usr/bin/docker compose -f docker-compose.prod.yml down
User=$USER
Group=docker

[Install]
WantedBy=multi-user.target
EOF

    sudo systemctl daemon-reload
    sudo systemctl enable pegasus-nest
    
    print_success "Systemd service created"
}

# Setup log rotation
setup_log_rotation() {
    print_step "Setting up log rotation..."
    
    sudo tee /etc/logrotate.d/pegasus-nest > /dev/null <<EOF
/opt/pegasus-nest/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 0644 $USER $USER
    postrotate
        docker compose -f /opt/pegasus-nest/docker-compose.prod.yml restart pegasus-nest 2>/dev/null || true
    endscript
}
EOF

    print_success "Log rotation configured"
}

# Create monitoring script
create_monitoring_script() {
    print_step "Creating monitoring script..."
    
    cat > /opt/pegasus-nest/monitor.sh <<'EOF'
#!/bin/bash

# Pegasus Nest API - Monitoring Script

check_api_health() {
    local response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health)
    if [ "$response" = "200" ]; then
        echo "✅ API is healthy"
        return 0
    else
        echo "❌ API health check failed (HTTP $response)"
        return 1
    fi
}

check_containers() {
    local running=$(docker compose -f /opt/pegasus-nest/docker-compose.prod.yml ps --services --filter "status=running" | wc -l)
    local total=$(docker compose -f /opt/pegasus-nest/docker-compose.prod.yml ps --services | wc -l)
    
    echo "📊 Containers: $running/$total running"
    
    if [ "$running" -ne "$total" ]; then
        echo "⚠️ Some containers are not running"
        docker compose -f /opt/pegasus-nest/docker-compose.prod.yml ps
        return 1
    fi
    return 0
}

main() {
    echo "🔍 Pegasus Nest API - Health Check $(date)"
    echo "================================================"
    
    check_containers
    check_api_health
    
    echo ""
    echo "📈 Resource Usage:"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
}

main "$@"
EOF

    chmod +x /opt/pegasus-nest/monitor.sh
    
    # Add to crontab for regular monitoring
    (crontab -l 2>/dev/null; echo "*/5 * * * * /opt/pegasus-nest/monitor.sh >> /opt/pegasus-nest/monitor.log 2>&1") | crontab -
    
    print_success "Monitoring script created"
}

# Main execution
main() {
    check_root
    collect_config
    
    print_step "Starting VPS setup..."
    
    install_dependencies
    install_docker
    install_docker_compose
    install_certbot
    setup_firewall
    setup_fail2ban
    setup_app_environment
    generate_ssl_certificates
    create_deployment_script
    create_systemd_service
    setup_log_rotation
    create_monitoring_script
    
    echo ""
    print_success "🎉 VPS setup complete!"
    print_success "Next steps:"
    echo "  1. Upload your application code to /opt/pegasus-nest/"
    echo "  2. Run: cd /opt/pegasus-nest && ./deploy.sh"
    echo "  3. Configure your DNS to point to this server:"
    echo "     - $API_SUBDOMAIN.$DOMAIN_NAME -> $(curl -s ifconfig.me)"
    echo "     - $UI_SUBDOMAIN.$DOMAIN_NAME -> $(curl -s ifconfig.me)"
    echo ""
    echo "🔧 Useful commands:"
    echo "  - Monitor: /opt/pegasus-nest/monitor.sh"
    echo "  - Deploy: /opt/pegasus-nest/deploy.sh"
    echo "  - Logs: docker compose -f /opt/pegasus-nest/docker-compose.prod.yml logs -f"
    echo "  - Status: systemctl status pegasus-nest"
    echo ""
    print_warning "Remember to reboot to ensure all group memberships take effect!"
}

main "$@"
