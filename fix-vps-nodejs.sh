#!/bin/bash

# Fix Node.js installation on VPS
# This script resolves the package conflict and completes the deployment

set -e
LOG_FILE="/tmp/nodejs-fix.log"

log() {
  local timestamp=$(date +"%Y-%m-%d %H:%M:%S")
  echo "[$timestamp] $1" | tee -a "$LOG_FILE"
}

log "🔧 Starting Node.js installation fix..."

# Stop existing containers
log "1. Stopping existing containers"
cd /opt/pegasus-nest
docker-compose -f docker-compose.simple.yml down || true

# Remove existing Node.js installation
log "2. Removing existing Node.js installation"
apt-get remove -y nodejs libnode-dev || true
apt-get autoremove -y
apt-get update

# Install Node.js 20
log "3. Installing Node.js 20"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Verify Node.js installation
log "4. Verifying Node.js installation"
node -v
npm -v

# Install pnpm
log "5. Installing pnpm@8.15.8"
npm install -g pnpm@8.15.8
pnpm -v

# Fix environment files
log "6. Verifying environment files"
if [ ! -f .env ] || [ ! -s .env ]; then
  log "Creating backend .env file"
  cat > .env << EOF
NODE_ENV=production
OPENROUTER_API_KEY=${OPENROUTER_API_KEY:-your_openrouter_api_key}
PORT=3000
EOF
fi

if [ ! -f frontend/.env.local ] || [ ! -s frontend/.env.local ]; then
  log "Creating frontend .env.local file"
  mkdir -p frontend
  cat > frontend/.env.local << EOF
NODE_ENV=production
NEXT_PUBLIC_API_URL=http://37.114.41.124
MONGODB_URL=${MONGODB_URL:-your_mongodb_url}
GITHUB_CLIENT_ID=${GITHUB_CLIENT_ID:-your_github_client_id}
GITHUB_CLIENT_SECRET=${GITHUB_CLIENT_SECRET:-your_github_client_secret}
BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET:-your_better_auth_secret}
BETTER_AUTH_URL=http://37.114.41.124
EOF
fi

# Start containers
log "7. Starting containers"
docker-compose -f docker-compose.simple.yml up -d

log "8. Checking container status"
docker-compose -f docker-compose.simple.yml ps

log "🏁 Node.js fix completed!"
log "Container logs will now be displayed (press Ctrl+C to exit):"
docker-compose -f docker-compose.simple.yml logs -f
apt-get remove -y libnode-dev nodejs-doc || true
apt-get remove -y nodejs || true

# Clean up package state
echo "Cleaning package state..."
apt-get autoremove -y
apt-get autoclean

# Force remove any remaining Node.js packages
echo "Force removing any remaining Node.js packages..."
dpkg --remove --force-remove-reinstreq nodejs || true
dpkg --remove --force-remove-reinstreq libnode-dev || true

# Clean dpkg state
echo "Cleaning dpkg state..."
dpkg --configure -a

# Install Node.js 20 cleanly
echo "Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Verify Node.js installation
echo "Verifying Node.js installation..."
node --version
npm --version

# Install pnpm globally
echo "Installing pnpm..."
npm install -g pnpm@8.15.8

# Verify pnpm installation
echo "Verifying pnpm installation..."
pnpm --version

echo "✅ Node.js and pnpm installation fixed!"

# Check if deployment directory exists and continue deployment
if [ -d "/opt/pegasus-nest" ]; then
    echo "🚀 Continuing deployment..."
    cd /opt/pegasus-nest
    
    # Make sure deployment script is executable
    chmod +x deploy-vps.sh
    
    # Continue deployment
    ./deploy-vps.sh
else
    echo "⚠️  Deployment directory not found. You may need to re-run the GitHub Actions workflow."
fi
