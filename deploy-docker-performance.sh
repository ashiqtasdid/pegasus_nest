#!/bin/bash

# Pegasus Nest Docker Deployment with Performance Monitoring
# This script handles the complete deployment process with health checks

set -e

echo "🚀 Starting Pegasus Nest Docker Deployment with Performance Monitoring..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
check_docker() {
    if ! docker info >/dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    print_success "Docker is running"
}

# Check if Docker Compose is available
check_docker_compose() {
    if ! command -v docker-compose >/dev/null 2>&1; then
        print_error "Docker Compose is not installed. Please install Docker Compose and try again."
        exit 1
    fi
    print_success "Docker Compose is available"
}

# Create environment file if it doesn't exist
setup_environment() {
    if [ ! -f .env.docker ]; then
        print_status "Creating Docker environment file..."
        if [ -f .env.docker.template ]; then
            cp .env.docker.template .env.docker
            print_success "Environment file created from template"
        else
            print_warning "No template found, creating basic environment file"
            cat > .env.docker << EOF
NODE_ENV=production
PORT=3000
DATABASE_URL=./data/pegasus.db
ENABLE_PERFORMANCE_MONITORING=true
MEMORY_MONITORING_ENABLED=true
MEMORY_MONITORING_INTERVAL=300000
MEMORY_THRESHOLD_WARNING=80
MEMORY_THRESHOLD_CRITICAL=90
ENABLE_REQUEST_LOGGING=true
ENABLE_COMPRESSION=true
CORS_ORIGIN=*
PM2_INSTANCES=max
PM2_MAX_MEMORY_RESTART=500M
ENABLE_GRACEFUL_SHUTDOWN=true
LOG_LEVEL=info
HEALTH_CHECK_INTERVAL=30000
DATABASE_POOL_SIZE=10
DATABASE_CACHE_SIZE=2000
ENABLE_STREAMING=true
PERFORMANCE_TRACKING_ENABLED=true
PERFORMANCE_CLEANUP_INTERVAL=3600000
EOF
        fi
    else
        print_success "Environment file already exists"
    fi
}

# Build Docker image
build_image() {
    print_status "Building Docker image..."
    docker build -t pegasus-nest:latest .
    if [ $? -eq 0 ]; then
        print_success "Docker image built successfully"
    else
        print_error "Failed to build Docker image"
        exit 1
    fi
}

# Stop existing containers
stop_existing() {
    print_status "Stopping existing containers..."
    docker-compose -f docker-compose.yml down --remove-orphans 2>/dev/null || true
    docker-compose -f docker-compose.monitoring.yml down --remove-orphans 2>/dev/null || true
    print_success "Existing containers stopped"
}

# Start containers
start_containers() {
    local compose_file=${1:-docker-compose.yml}
    print_status "Starting containers with $compose_file..."
    
    docker-compose -f $compose_file up -d
    if [ $? -eq 0 ]; then
        print_success "Containers started successfully"
    else
        print_error "Failed to start containers"
        exit 1
    fi
}

# Wait for service to be ready
wait_for_service() {
    local max_attempts=30
    local attempt=1
    local port=${1:-3000}
    
    print_status "Waiting for service to be ready on port $port..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s -f http://localhost:$port/health >/dev/null 2>&1; then
            print_success "Service is ready!"
            return 0
        fi
        
        echo -n "."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    print_error "Service failed to start within $((max_attempts * 2)) seconds"
    return 1
}

# Run health checks
run_health_checks() {
    local port=${1:-3000}
    print_status "Running health checks..."
    
    # Basic health check
    if curl -s -f http://localhost:$port/health >/dev/null 2>&1; then
        print_success "✓ Basic health check passed"
    else
        print_error "✗ Basic health check failed"
        return 1
    fi
    
    # Memory monitoring check
    if curl -s -f http://localhost:$port/health/memory >/dev/null 2>&1; then
        print_success "✓ Memory monitoring check passed"
    else
        print_warning "⚠ Memory monitoring check failed"
    fi
    
    # Database health check
    if curl -s -f http://localhost:$port/health/database >/dev/null 2>&1; then
        print_success "✓ Database health check passed"
    else
        print_warning "⚠ Database health check failed"
    fi
    
    # Performance monitoring check
    if curl -s -f http://localhost:$port/health/performance >/dev/null 2>&1; then
        print_success "✓ Performance monitoring check passed"
    else
        print_warning "⚠ Performance monitoring check failed"
    fi
    
    return 0
}

# Display service information
show_service_info() {
    local port=${1:-3000}
    print_success "Pegasus Nest is now running!"
    echo ""
    echo "🌐 Service URLs:"
    echo "   Main API: http://localhost:$port"
    echo "   Health Check: http://localhost:$port/health"
    echo "   Memory Status: http://localhost:$port/health/memory"
    echo "   Database Status: http://localhost:$port/health/database"
    echo "   Performance Metrics: http://localhost:$port/health/performance"
    echo "   Full Metrics: http://localhost:$port/health/metrics"
    echo ""
    echo "📊 Monitoring:"
    echo "   View logs: docker-compose logs -f"
    echo "   View PM2 status: docker-compose exec app pm2 status"
    echo "   View PM2 logs: docker-compose exec app pm2 logs"
    echo "   View PM2 monitoring: docker-compose exec app pm2 monit"
    echo ""
    echo "🔧 Management:"
    echo "   Stop: docker-compose down"
    echo "   Restart: docker-compose restart"
    echo "   Rebuild: $0 --rebuild"
}

# Parse command line arguments
MONITORING_MODE=false
REBUILD=false
PORT=3000

while [[ $# -gt 0 ]]; do
    case $1 in
        --monitoring)
            MONITORING_MODE=true
            shift
            ;;
        --rebuild)
            REBUILD=true
            shift
            ;;
        --port)
            PORT="$2"
            shift 2
            ;;
        --help)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --monitoring    Use monitoring-enabled compose file (includes Grafana/Loki)"
            echo "  --rebuild       Force rebuild of Docker image"
            echo "  --port PORT     Specify port (default: 3000)"
            echo "  --help          Show this help message"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Main deployment process
main() {
    print_status "Starting deployment process..."
    
    # Pre-deployment checks
    check_docker
    check_docker_compose
    setup_environment
    
    # Stop existing containers
    stop_existing
    
    # Build image if needed
    if [ "$REBUILD" = true ] || ! docker image inspect pegasus-nest:latest >/dev/null 2>&1; then
        build_image
    else
        print_success "Using existing Docker image"
    fi
    
    # Choose compose file
    local compose_file="docker-compose.yml"
    if [ "$MONITORING_MODE" = true ]; then
        compose_file="docker-compose.monitoring.yml"
        print_status "Using monitoring-enabled configuration"
    fi
    
    # Start containers
    start_containers $compose_file
    
    # Wait for service
    if wait_for_service $PORT; then
        # Run health checks
        if run_health_checks $PORT; then
            show_service_info $PORT
        else
            print_warning "Some health checks failed, but service is running"
            show_service_info $PORT
        fi
    else
        print_error "Deployment failed - service did not start properly"
        print_status "Checking logs..."
        docker-compose -f $compose_file logs --tail=50
        exit 1
    fi
}

# Run main function
main "$@"
