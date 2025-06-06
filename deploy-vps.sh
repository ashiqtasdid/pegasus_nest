#!/bin/bash

# VPS Deployment Script for Pegasus Nest API
echo "🚀 Starting Pegasus Nest API deployment on VPS..."

# Exit on any error
set -e

# Disable Docker BuildKit to avoid buildx issues
export DOCKER_BUILDKIT=0
export COMPOSE_DOCKER_CLI_BUILD=0

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to ensure Docker buildx is available or BuildKit is properly disabled
ensure_docker_build_compatibility() {
    log "Ensuring Docker build compatibility..."
    
    # Check if docker buildx is available
    if docker buildx version &>/dev/null; then
        log "Docker buildx is available"
        return 0
    fi
    
    log "Docker buildx not found, trying to install it..."
    
    # Try to install Docker buildx first
    if command_exists apt-get; then
        apt-get update -qq
        apt-get install -y docker-buildx-plugin 2>/dev/null || {
            log "Failed to install docker-buildx-plugin, disabling BuildKit instead..."
            
            # Install jq if not available for JSON manipulation
            apt-get install -y jq 2>/dev/null || {
                log "WARNING: jq not available, using manual JSON editing..."
                # Fallback: manually disable BuildKit
                echo '{"features": {"buildkit": false}}' > /etc/docker/daemon.json
                systemctl restart docker
                sleep 5
                return 0
            }
            
            # Create or update Docker daemon configuration to disable BuildKit
            if [ ! -f /etc/docker/daemon.json ]; then
                echo '{"features": {"buildkit": false}}' > /etc/docker/daemon.json
                log "Created /etc/docker/daemon.json with BuildKit disabled"
            else
                # Check if BuildKit is already configured
                if ! grep -q '"buildkit"' /etc/docker/daemon.json; then
                    # Add buildkit config to existing daemon.json
                    jq '. + {"features": {"buildkit": false}}' /etc/docker/daemon.json > /tmp/daemon.json.tmp
                    mv /tmp/daemon.json.tmp /etc/docker/daemon.json
                    log "Updated /etc/docker/daemon.json to disable BuildKit"
                fi
            fi
            
            # Restart Docker daemon to apply changes
            log "Restarting Docker daemon..."
            systemctl restart docker
            sleep 5
        }
    fi
    
    # Verify Docker is running
    docker version --format '{{.Server.Version}}' || {
        log "ERROR: Docker failed to restart properly"
        exit 1
    }
    
    # Check again if buildx is now available
    if docker buildx version &>/dev/null; then
        log "Docker buildx is now available"
    else
        log "BuildKit disabled, using legacy Docker build"
    fi
}

# Stop existing containers
log "Stopping existing containers..."
docker-compose down 2>/dev/null || true

# Ensure Docker build compatibility before proceeding
ensure_docker_build_compatibility

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

# Ensure BuildKit is disabled for this session
export DOCKER_BUILDKIT=0
export COMPOSE_DOCKER_CLI_BUILD=0
export BUILDKIT_PROGRESS=plain

log "Docker info:"
docker info | grep -E "(Server Version|Storage Driver|Cgroup Driver|BuildKit)" || true

docker-compose up --build -d

# Wait for services to be ready
log "Waiting for API to start..."
sleep 30

# Check if container is running
log "Checking container status..."
if ! docker ps --format "table {{.Names}}\t{{.Status}}" | grep "pegasus-nest-api"; then
    log "ERROR: API container failed to start!"
    docker-compose logs
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
