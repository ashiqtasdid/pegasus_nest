#!/bin/bash
# Fix Node.js installation conflict on Ubuntu VPS
# This script resolves the package conflict between Node.js 20 and libnode-dev

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

# Clean up any orphaned containers with the same name
log "1a. Cleaning up any orphaned containers"
docker ps -a | grep pegasus-nest-api && docker rm -f pegasus-nest-api || true
docker ps -a | grep pegasus-nest-frontend && docker rm -f pegasus-nest-frontend || true
docker ps -a | grep pegasus-ui && docker rm -f pegasus-ui || true
docker ps -a | grep pegasus-nginx && docker rm -f pegasus-nginx || true

# Remove existing Node.js installation
log "2. Removing conflicting packages"
apt-get remove -y libnode-dev || true
apt-get remove -y nodejs || true
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

# Start containers
log "6. Starting containers"
cd /opt/pegasus-nest

# Ensure clean networks
log "6a. Cleaning up Docker networks"
docker network ls | grep pegasus-network && docker network rm pegasus-nest_pegasus-network || true
docker network prune -f

# Start services
log "6b. Starting services"
docker-compose -f docker-compose.simple.yml up -d

log "7. Checking container status"
docker-compose -f docker-compose.simple.yml ps

log "🏁 Node.js fix completed!"
echo ""
echo "Container logs:"
docker-compose -f docker-compose.simple.yml logs
