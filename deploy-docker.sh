#!/bin/bash

# Docker-based VPS Deployment Script for Pegasus Nest API
echo "🐳 Starting Docker deployment of Pegasus Nest API..."

# Exit on any error
set -e

# Disable Docker BuildKit to avoid compatibility issues
export DOCKER_BUILDKIT=0
export COMPOSE_DOCKER_CLI_BUILD=0
export BUILDKIT_PROGRESS=plain

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to ensure Docker BuildKit compatibility
ensure_docker_compatibility() {
    log "🔧 Ensuring Docker compatibility..."
    
    # Check if docker buildx is available
    if docker buildx version &>/dev/null; then
        log "✅ Docker buildx is available"
        return 0
    fi
    
    log "⚠️ Docker buildx not found, configuring compatibility..."
    
    # Try to install Docker buildx plugin
    if command_exists apt-get; then
        apt-get update -qq
        if apt-get install -y docker-buildx-plugin 2>/dev/null; then
            log "✅ Docker buildx plugin installed"
            return 0
        fi
    fi
    
    # Fallback: Disable BuildKit in daemon configuration
    log "📝 Disabling BuildKit in Docker daemon..."
    
    # Install jq for JSON manipulation
    apt-get install -y jq 2>/dev/null || {
        log "⚠️ jq not available, using manual JSON configuration..."
        echo '{"features": {"buildkit": false}}' > /etc/docker/daemon.json
        systemctl restart docker
        sleep 5
        return 0
    }
    
    # Create or update Docker daemon configuration
    if [ ! -f /etc/docker/daemon.json ]; then
        echo '{"features": {"buildkit": false}}' > /etc/docker/daemon.json
        log "📄 Created /etc/docker/daemon.json with BuildKit disabled"
    else
        if ! grep -q '"buildkit"' /etc/docker/daemon.json; then
            jq '. + {"features": {"buildkit": false}}' /etc/docker/daemon.json > /tmp/daemon.json.tmp
            mv /tmp/daemon.json.tmp /etc/docker/daemon.json
            log "📄 Updated /etc/docker/daemon.json to disable BuildKit"
        fi
    fi
    
    # Restart Docker daemon
    log "🔄 Restarting Docker daemon..."
    systemctl restart docker
    sleep 5
    
    # Verify Docker is running
    docker version --format '{{.Server.Version}}' || {
        log "❌ ERROR: Docker failed to restart properly"
        exit 1
    }
    
    log "✅ Docker compatibility configured"
}

# Validate environment
validate_environment() {
    log "🔍 Validating environment..."
    
    if [ ! -f .env ]; then
        log "❌ ERROR: .env file not found!"
        log "💡 Please create a .env file with required environment variables:"
        log "   NODE_ENV=production"
        log "   OPENROUTER_API_KEY=your_api_key_here"
        log "   PORT=3000"
        exit 1
    fi
    
    if ! grep -q "OPENROUTER_API_KEY=" .env || grep -q "OPENROUTER_API_KEY=your_api_key_here" .env; then
        log "❌ ERROR: OPENROUTER_API_KEY not configured in .env file"
        exit 1
    fi
    
    log "✅ Environment validation passed"
}

# Clean up existing Docker resources
cleanup_docker() {
    log "🧹 Cleaning up existing Docker resources..."
    
    # Stop and remove existing containers
    docker-compose down --remove-orphans 2>/dev/null || true
    
    # Remove specific containers if they exist
    docker ps -a --format "table {{.Names}}" | grep -q "pegasus-nest-api" && docker rm -f pegasus-nest-api || true
    
    # Clean up networks
    docker network ls --format "table {{.Name}}" | grep -q "pegasus-nest_pegasus-network" && docker network rm pegasus-nest_pegasus-network || true
    docker network prune -f
    
    # Clean up unused images and volumes to save space
    docker image prune -f
    docker volume prune -f
    
    log "✅ Docker cleanup completed"
}

# Deploy with Docker Compose
deploy_with_docker() {
    log "🚀 Deploying with Docker Compose..."
    
    # Load environment variables
    if [ -f .env ]; then
        log "📂 Loading environment variables from .env"
        set -a
        source .env
        set +a
    fi
    
    # Pull base images to ensure we have the latest
    log "📥 Pulling base Docker images..."
    docker pull node:20-alpine
    
    # Build and start services
    log "🔨 Building and starting services..."
    if docker-compose up --build -d --force-recreate; then
        log "✅ Docker Compose deployment successful!"
    else
        log "❌ Docker Compose deployment failed!"
        log "📋 Trying npm fallback configuration..."
        
        if docker-compose -f docker-compose.npm.yml up --build -d --force-recreate; then
            log "✅ NPM fallback deployment successful!"
        else
            log "❌ Both deployments failed!"
            log "📋 Docker Compose logs:"
            docker-compose logs --tail=20 2>/dev/null || true
            exit 1
        fi
    fi
}

# Verify deployment
verify_deployment() {
    log "🔍 Verifying deployment..."
    
    # Wait for container to start
    sleep 15
    
    # Check if container is running
    if ! docker ps --format "table {{.Names}}\t{{.Status}}" | grep -q "pegasus-nest-api"; then
        log "❌ ERROR: Container is not running!"
        log "📋 Container logs:"
        docker logs pegasus-nest-api 2>/dev/null || docker-compose logs --tail=20
        exit 1
    fi
    
    log "✅ Container is running"
    
    # Test health endpoint
    log "🏥 Testing health endpoint..."
    HEALTH_CHECK_PASSED=false
    
    for i in {1..30}; do
        if curl -f http://localhost:3000/health 2>/dev/null; then
            log "✅ Health check passed!"
            HEALTH_CHECK_PASSED=true
            break
        fi
        log "⏳ Waiting for API to be ready... ($i/30)"
        sleep 2
    done
    
    if [ "$HEALTH_CHECK_PASSED" = false ]; then
        log "❌ Health check failed!"
        log "📋 Container logs:"
        docker logs pegasus-nest-api --tail=30 2>/dev/null || docker-compose logs --tail=30
        exit 1
    fi
}

# Display deployment summary
show_summary() {
    log "🎉 Deployment completed successfully!"
    echo ""
    echo "📊 Deployment Summary:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🌐 API URL: http://37.114.41.124:3000"
    echo "🏥 Health Check: http://37.114.41.124:3000/health"
    echo "🐳 Container Status:"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep pegasus-nest-api || echo "   No containers found"
    echo ""
    echo "📋 Useful Commands:"
    echo "   View logs: docker logs pegasus-nest-api -f"
    echo "   Check status: docker ps"
    echo "   Stop service: docker-compose down"
    echo "   Restart service: docker-compose restart"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# Main deployment flow
main() {
    log "🚀 Starting Docker-based deployment process..."
    
    validate_environment
    ensure_docker_compatibility
    cleanup_docker
    deploy_with_docker
    verify_deployment
    show_summary
    
    log "✅ All deployment steps completed successfully!"
}

# Run main function
main "$@"
