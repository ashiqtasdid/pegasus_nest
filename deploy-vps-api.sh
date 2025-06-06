#!/bin/bash

# VPS Deployment Script for Pegasus Nest API
echo "🚀 Starting Pegasus Nest API deployment on VPS..."

# Exit on any error
set -e

# Initialize variables
COMPOSE_FILE=""

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
docker-compose down 2>/dev/null || true

# Clean up any orphaned containers
log "Cleaning up any orphaned containers..."
docker ps -a | grep pegasus-nest-api && docker rm -f pegasus-nest-api || true

# Ensure Docker networks are clean
log "Cleaning up Docker networks..."
docker network ls | grep pegasus-network && docker network rm pegasus-nest_pegasus-network || true
docker network prune -f

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

# Install or update pnpm
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

# Check if environment file exists
if [ ! -f .env ]; then
    log "ERROR: .env file not found!"
    exit 1
fi

# Validate environment file
log "Validating environment file..."
if ! grep -q "OPENROUTER_API_KEY" .env; then
    log "WARNING: OPENROUTER_API_KEY not found in .env"
fi

# Load environment variables
log "Loading environment variables..."
if [ -f .env ]; then
    log "Loading variables from .env file"
    export $(grep -v '^#' .env | xargs)
else
    log "WARNING: .env file not found, using existing environment variables"
fi

log "Pulling base images..."
docker pull node:20-alpine

# Build and start services
log "Building and starting API service..."
export DOCKER_BUILDKIT=0

# Clean up any existing containers to avoid conflicts
log "Cleaning up existing containers..."
docker-compose down --remove-orphans 2>/dev/null || true

# Remove any dangling images to save space
log "Cleaning up dangling images..."
docker image prune -f 2>/dev/null || true

# Try building with pnpm first
log "Attempting to build API container with pnpm..."
if docker-compose up --build -d --force-recreate; then
    log "SUCCESS: Container built with pnpm!"
else
    log "WARNING: pnpm build failed, trying with npm as fallback..."
    
    # Clean up failed attempt
    docker-compose down --remove-orphans 2>/dev/null || true
    
    # Try with npm-based docker-compose
    log "Building with npm fallback..."
    if docker-compose -f docker-compose.npm.yml up --build -d --force-recreate; then
        log "SUCCESS: Container built with npm fallback!"
        # Update the check below to use the npm compose file
        COMPOSE_FILE="-f docker-compose.npm.yml"
    else
        log "ERROR: Both pnpm and npm builds failed!"
        log "Docker compose logs (pnpm):"
        docker-compose logs 2>/dev/null || true
        log "Docker compose logs (npm):"
        docker-compose -f docker-compose.npm.yml logs 2>/dev/null || true
        log "Docker system info:"
        docker system df
        exit 1
    fi
fi

# Wait for services to be ready
log "Waiting for API to start..."
sleep 30

# Check if container is running
log "Checking container status..."
if ! docker ps --format "table {{.Names}}\t{{.Status}}" | grep "pegasus-nest-api"; then
    log "ERROR: API container failed to start!"
    if [ "${COMPOSE_FILE}" = "-f docker-compose.npm.yml" ]; then
        docker-compose -f docker-compose.npm.yml logs
    else
        docker-compose logs
    fi
    exit 1
fi

# Test health endpoint
log "Testing API health..."
HEALTH_CHECK_PASSED=false
for i in {1..30}; do
    if curl -f http://localhost:3000/health 2>/dev/null; then
        log "✅ API health endpoint responded!"
        HEALTH_CHECK_PASSED=true
        break
    fi
    log "Waiting for API to be ready... ($i/30)"
    sleep 3
done

if [ "$HEALTH_CHECK_PASSED" = false ]; then
    log "❌ API health check failed!"
    log "Container logs:"
    docker-compose logs --tail=20
    exit 1
fi

log "🎉 API deployment completed successfully!"
log "Running containers:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo "✅ Pegasus Nest API is now running at http://37.114.41.124:3000"
echo "📝 Check logs with: docker-compose logs -f"
