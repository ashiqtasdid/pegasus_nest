#!/bin/bash

# VPS Deployment Script for Pegasus Nest
echo "🚀 Starting Pegasus Nest deployment on VPS..."

# Exit on any error
set -e

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Stop existing containers
log "Stopping existing containers..."
docker-compose -f docker-compose.simple.yml down 2>/dev/null || true

# Remove old images to save space
log "Cleaning up old images..."
docker system prune -f --volumes

# Update Node.js and pnpm to compatible versions if needed
log "Checking Node.js and pnpm versions..."
NODE_VERSION=$(node --version 2>/dev/null | sed 's/v//' | cut -d'.' -f1 || echo "0")
if [ "$NODE_VERSION" -lt 20 ]; then
    log "Updating Node.js to version 20..."
    # First remove potentially conflicting packages
    log "Removing any conflicting Node.js packages..."
    apt-get remove -y libnode-dev nodejs || true
    apt-get autoremove -y
    
    # Install Node.js 20
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    apt-get install -y nodejs
fi

if ! command_exists pnpm; then
    log "Installing pnpm..."
    npm install -g pnpm@8.15.8
else
    PNPM_VERSION=$(pnpm --version | cut -d'.' -f1)
    if [ "$PNPM_VERSION" -gt 8 ]; then
        log "Downgrading pnpm to compatible version..."
        npm install -g pnpm@8.15.8
    fi
fi

# Verify versions
log "Node.js version: $(node --version)"
log "pnpm version: $(pnpm --version)"

# Check if environment files exist
if [ ! -f .env ]; then
    log "ERROR: .env file not found!"
    exit 1
fi

if [ ! -f frontend/.env.local ]; then
    log "ERROR: frontend/.env.local file not found!"
    exit 1
fi

# Validate environment files
log "Validating environment files..."
if ! grep -q "OPENROUTER_API_KEY" .env; then
    log "WARNING: OPENROUTER_API_KEY not found in .env"
fi

if ! grep -q "MONGODB_URL" frontend/.env.local; then
    log "WARNING: MONGODB_URL not found in frontend/.env.local"
fi

# Pull latest base images
log "Pulling base images..."
docker pull node:20-alpine
docker pull nginx:alpine

# Build and start services
log "Building and starting services..."
export DOCKER_BUILDKIT=1
docker-compose -f docker-compose.simple.yml up --build -d

# Wait for services to be ready
log "Waiting for services to start..."
sleep 30

# Check if containers are running
log "Checking container status..."
if ! docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "(pegasus-nest|pegasus-frontend|nginx)"; then
    log "ERROR: Some containers failed to start!"
    docker-compose -f docker-compose.simple.yml logs
    exit 1
fi

# Test health endpoint
log "Testing application health..."
HEALTH_CHECK_PASSED=false
for i in {1..30}; do
    if curl -f http://localhost/health 2>/dev/null; then
        log "✅ Health endpoint responded!"
        HEALTH_CHECK_PASSED=true
        break
    elif curl -f http://localhost 2>/dev/null; then
        log "✅ Application is responding!"
        HEALTH_CHECK_PASSED=true
        break
    fi
    log "Waiting for application to be ready... ($i/30)"
    sleep 3
done

if [ "$HEALTH_CHECK_PASSED" = false ]; then
    log "❌ Application health check failed!"
    log "Container logs:"
    docker-compose -f docker-compose.simple.yml logs --tail=20
    exit 1
fi

log "🎉 Deployment completed successfully!"
log "Running containers:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo "✅ Pegasus Nest is now running at http://37.114.41.124"
echo "📝 Check logs with: docker-compose -f docker-compose.simple.yml logs -f"
