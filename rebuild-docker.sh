#!/bin/bash

# Pegasus Nest Docker Rebuild Script
# This script sets proper file permissions, cleans Docker cache, and rebuilds the application
# Created: June 7, 2025

set -e  # Exit on any error

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

# Function to check if Docker is running
check_docker() {
    if ! docker info >/dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker first."
        exit 1
    fi
    print_success "Docker is running"
}

# Function to set file permissions
set_file_permissions() {
    print_status "Setting file permissions..."
    
    # Set directory permissions
    find . -type d -exec chmod 755 {} \;
    
    # Set file permissions
    find . -type f -exec chmod 644 {} \;
    
    # Make scripts executable
    chmod +x *.sh
    chmod +x deploy-*.sh
    chmod +x fix-*.sh
    chmod +x setup-env.sh
    
    # Set Node.js specific permissions
    if [ -d "node_modules" ]; then
        chmod -R 755 node_modules/
    fi
    
    # Set generated folder permissions
    if [ -d "generated" ]; then
        chmod -R 755 generated/
    fi
    
    # Set logs folder permissions
    if [ -d "logs" ]; then
        chmod -R 755 logs/
    fi
    
    # Set Docker files permissions
    chmod 644 Dockerfile*
    chmod 644 docker-compose*.yml
    
    print_success "File permissions set successfully"
}

# Function to stop and remove existing containers
cleanup_containers() {
    print_status "Stopping and removing existing containers..."
    
    # Stop all containers related to pegasus-nest
    CONTAINERS=$(docker ps -a --filter "name=pegasus" --format "{{.Names}}" 2>/dev/null || true)
    if [ ! -z "$CONTAINERS" ]; then
        echo "$CONTAINERS" | xargs -r docker stop
        echo "$CONTAINERS" | xargs -r docker rm
        print_success "Removed existing pegasus-nest containers"
    else
        print_warning "No pegasus-nest containers found"
    fi
    
    # Stop containers from docker-compose files
    for compose_file in docker-compose.yml docker-compose.simple.yml docker-compose.npm.yml; do
        if [ -f "$compose_file" ]; then
            print_status "Stopping containers from $compose_file..."
            docker-compose -f "$compose_file" down --remove-orphans 2>/dev/null || true
        fi
    done
}

# Function to remove Docker images
cleanup_images() {
    print_status "Removing existing Docker images..."
    
    # Remove pegasus-nest images
    IMAGES=$(docker images --filter "reference=pegasus*" --format "{{.Repository}}:{{.Tag}}" 2>/dev/null || true)
    if [ ! -z "$IMAGES" ]; then
        echo "$IMAGES" | xargs -r docker rmi -f
        print_success "Removed existing pegasus-nest images"
    else
        print_warning "No pegasus-nest images found"
    fi
    
    # Remove dangling images
    DANGLING=$(docker images -f "dangling=true" -q 2>/dev/null || true)
    if [ ! -z "$DANGLING" ]; then
        echo "$DANGLING" | xargs -r docker rmi -f
        print_success "Removed dangling images"
    fi
}

# Function to clean Docker cache
cleanup_docker_cache() {
    print_status "Cleaning Docker cache and unused resources..."
    
    # Clean build cache
    docker builder prune -f
    
    # Clean system (containers, networks, images, cache)
    docker system prune -f
    
    # Clean volumes (be careful with this)
    print_warning "Cleaning Docker volumes..."
    docker volume prune -f
    
    print_success "Docker cache cleaned successfully"
}

# Function to build and start the application
build_and_start() {
    print_status "Building and starting the application..."
    
    # Choose which docker-compose file to use
    COMPOSE_FILE="docker-compose.yml"
    
    # Check if specific compose file exists
    if [ -f "docker-compose.simple.yml" ]; then
        read -p "Which Docker Compose file would you like to use? (1) docker-compose.yml (2) docker-compose.simple.yml (3) docker-compose.npm.yml [1]: " choice
        case $choice in
            2) COMPOSE_FILE="docker-compose.simple.yml" ;;
            3) COMPOSE_FILE="docker-compose.npm.yml" ;;
            *) COMPOSE_FILE="docker-compose.yml" ;;
        esac
    fi
    
    print_status "Using $COMPOSE_FILE"
    
    # Build and start
    docker-compose -f "$COMPOSE_FILE" build --no-cache
    docker-compose -f "$COMPOSE_FILE" up -d
    
    print_success "Application built and started successfully"
    
    # Show running containers
    print_status "Running containers:"
    docker-compose -f "$COMPOSE_FILE" ps
}

# Function to show logs
show_logs() {
    read -p "Would you like to see the application logs? [y/N]: " show_logs_choice
    if [[ $show_logs_choice =~ ^[Yy]$ ]]; then
        print_status "Showing application logs (Press Ctrl+C to exit)..."
        sleep 2
        docker-compose logs -f
    fi
}

# Function to display help
show_help() {
    echo "Pegasus Nest Docker Rebuild Script"
    echo ""
    echo "This script will:"
    echo "  1. Set proper file permissions"
    echo "  2. Stop and remove existing Docker containers"
    echo "  3. Remove existing Docker images"
    echo "  4. Clean Docker cache and unused resources"
    echo "  5. Rebuild and start the application"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "OPTIONS:"
    echo "  -h, --help     Show this help message"
    echo "  -q, --quiet    Run in quiet mode (less output)"
    echo "  --no-cache     Skip Docker cache cleanup"
    echo "  --permissions-only    Only set file permissions and exit"
    echo ""
}

# Parse command line arguments
QUIET=false
SKIP_CACHE=false
PERMISSIONS_ONLY=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -q|--quiet)
            QUIET=true
            shift
            ;;
        --no-cache)
            SKIP_CACHE=true
            shift
            ;;
        --permissions-only)
            PERMISSIONS_ONLY=true
            shift
            ;;
        *)
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Main execution
main() {
    if [ "$QUIET" = false ]; then
        echo -e "${BLUE}"
        echo "╔══════════════════════════════════════════════════════════════╗"
        echo "║                 Pegasus Nest Docker Rebuild                 ║"
        echo "║                                                              ║"
        echo "║  This script will clean and rebuild your Docker environment ║"
        echo "╚══════════════════════════════════════════════════════════════╝"
        echo -e "${NC}"
        echo ""
        
        read -p "Are you sure you want to proceed? This will remove all existing containers and images. [y/N]: " confirm
        if [[ ! $confirm =~ ^[Yy]$ ]]; then
            print_warning "Operation cancelled by user"
            exit 0
        fi
    fi
    
    # Start execution
    print_status "Starting Docker rebuild process..."
    
    # Set file permissions
    set_file_permissions
    
    # Exit early if only permissions requested
    if [ "$PERMISSIONS_ONLY" = true ]; then
        print_success "File permissions set. Exiting as requested."
        exit 0
    fi
    
    # Check Docker
    check_docker
    
    # Cleanup process
    cleanup_containers
    cleanup_images
    
    if [ "$SKIP_CACHE" = false ]; then
        cleanup_docker_cache
    else
        print_warning "Skipping Docker cache cleanup as requested"
    fi
    
    # Rebuild and start
    build_and_start
    
    # Final status
    echo ""
    print_success "🎉 Docker rebuild completed successfully!"
    echo ""
    print_status "Your Pegasus Nest application should now be running."
    print_status "You can check the status with: docker-compose ps"
    print_status "View logs with: docker-compose logs -f"
    echo ""
    
    # Optionally show logs
    if [ "$QUIET" = false ]; then
        show_logs
    fi
}

# Run main function
main "$@"
