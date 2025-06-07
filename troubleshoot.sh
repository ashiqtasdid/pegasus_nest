#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔧 Pegasus Nest Troubleshooting Script${NC}"
echo "=========================================="

# Check Docker status
echo -e "\n${YELLOW}🐳 Checking Docker Status:${NC}"
if command -v docker &> /dev/null; then
    echo "✅ Docker is installed"
    docker --version
    
    # Check if Docker daemon is running
    if docker info &> /dev/null; then
        echo "✅ Docker daemon is running"
    else
        echo "❌ Docker daemon is not running"
        exit 1
    fi
else
    echo "❌ Docker is not installed"
    exit 1
fi

# Check container status
echo -e "\n${YELLOW}📦 Container Status:${NC}"
CONTAINERS=$(docker ps -a --filter name=pegasus --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}")
if [ -z "$CONTAINERS" ]; then
    echo "❌ No Pegasus containers found"
else
    echo "$CONTAINERS"
fi

# Check images
echo -e "\n${YELLOW}🖼️ Image Status:${NC}"
IMAGES=$(docker images --filter reference=pegasus-nest --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}")
if [ -z "$IMAGES" ]; then
    echo "❌ No Pegasus images found"
else
    echo "$IMAGES"
fi

# Check logs if container exists
CONTAINER_ID=$(docker ps -aq --filter name=pegasus-nest)
if [ ! -z "$CONTAINER_ID" ]; then
    echo -e "\n${YELLOW}📝 Recent Container Logs:${NC}"
    docker logs --tail 20 $CONTAINER_ID
fi

# Check port usage
echo -e "\n${YELLOW}🌐 Port Status:${NC}"
if command -v netstat &> /dev/null; then
    netstat -tlnp | grep :3000 || echo "Port 3000 is free"
elif command -v ss &> /dev/null; then
    ss -tlnp | grep :3000 || echo "Port 3000 is free"
else
    echo "⚠️ Cannot check port status (netstat/ss not available)"
fi

# Check system resources
echo -e "\n${YELLOW}💾 System Resources:${NC}"
echo "Memory Usage:"
free -h
echo -e "\nDisk Usage:"
df -h . | tail -1

# Check Node.js and PM2 status
echo -e "\n${YELLOW}⚙️ Node.js Status:${NC}"
if command -v node &> /dev/null; then
    echo "✅ Node.js: $(node --version)"
else
    echo "❌ Node.js not installed"
fi

if command -v npm &> /dev/null; then
    echo "✅ npm: $(npm --version)"
else
    echo "❌ npm not installed"
fi

if command -v pm2 &> /dev/null; then
    echo "✅ PM2: $(pm2 --version)"
    echo -e "\nPM2 Status:"
    pm2 list
else
    echo "❌ PM2 not installed globally"
fi

# Health check
echo -e "\n${YELLOW}🏥 Health Check:${NC}"
if curl -f http://localhost:3000/health &> /dev/null; then
    echo "✅ Application is responding on http://localhost:3000"
else
    echo "❌ Application not responding on http://localhost:3000"
fi

# Recommendations
echo -e "\n${YELLOW}💡 Troubleshooting Steps:${NC}"
echo "1. Try: ./deploy.sh --clean-cache"
echo "2. Check logs: docker logs pegasus-nest"
echo "3. Restart: docker-compose down && docker-compose up -d"
echo "4. Clean rebuild: docker system prune -f && ./deploy.sh"
echo "5. Simple mode: ./start-simple.sh"

echo -e "\n${GREEN}Troubleshooting complete!${NC}"

# Pegasus Nest Troubleshooting Script
# This script helps diagnose deployment and runtime issues

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

print_header() {
    echo -e "\n${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${PURPLE}  $1${NC}"
    echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

print_status() {
    echo -e "${BLUE}🔍 [DIAG]${NC} $1"
}

print_success() {
    echo -e "${GREEN}✅ [OK]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠️  [WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}❌ [ERROR]${NC} $1"
}

# Function to check Docker status
check_docker_status() {
    print_header "🐳 DOCKER STATUS CHECK"
    
    # Check if Docker is installed
    if ! command -v docker >/dev/null 2>&1; then
        print_error "Docker is not installed"
        return 1
    fi
    print_success "Docker is installed"
    
    # Check if Docker daemon is running
    if ! docker info >/dev/null 2>&1; then
        print_error "Docker daemon is not running"
        return 1
    fi
    print_success "Docker daemon is running"
    
    # Show Docker version
    print_status "Docker version: $(docker --version)"
    
    # Check Docker Compose
    if ! command -v docker-compose >/dev/null 2>&1; then
        print_error "Docker Compose is not installed"
        return 1
    fi
    print_success "Docker Compose is available"
    print_status "Docker Compose version: $(docker-compose --version)"
    
    # Show system resources
    print_status "System resources:"
    echo "  Memory: $(free -h | grep '^Mem:' | awk '{print $2}' || echo 'Unknown')"
    echo "  Disk: $(df -h . | tail -1 | awk '{print $4}' || echo 'Unknown') available"
    echo "  CPU cores: $(nproc || echo 'Unknown')"
}

# Function to check container status
check_container_status() {
    print_header "📦 CONTAINER STATUS"
    
    print_status "Running containers:"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    
    print_status "All project containers:"
    docker-compose ps
    
    # Check if our container is running
    if docker-compose ps | grep -q "pegasus-nest-api"; then
        if docker-compose ps | grep "pegasus-nest-api" | grep -q "Up"; then
            print_success "Pegasus Nest container is running"
            
            # Get container ID
            local container_id=$(docker-compose ps -q)
            if [[ -n "$container_id" ]]; then
                print_status "Container details:"
                docker inspect $container_id --format '{{.State.Status}}'
                docker inspect $container_id --format '{{.Config.Env}}'
            fi
        else
            print_error "Pegasus Nest container exists but is not running"
        fi
    else
        print_warning "Pegasus Nest container not found"
    fi
}

# Function to check application logs
check_application_logs() {
    print_header "📋 APPLICATION LOGS"
    
    if docker-compose ps | grep -q "pegasus-nest-api"; then
        print_status "Last 50 lines of application logs:"
        docker-compose logs --tail=50
        
        print_status "PM2 logs from container:"
        docker-compose exec -T app pm2 logs --lines 20 2>/dev/null || {
            print_warning "Could not access PM2 logs"
        }
        
        print_status "PM2 process status:"
        docker-compose exec -T app pm2 status 2>/dev/null || {
            print_warning "Could not access PM2 status"
        }
    else
        print_warning "No container running to check logs"
    fi
    
    # Check local log files
    print_status "Local log files:"
    if [[ -d "./logs" ]]; then
        ls -la ./logs/
        if [[ -f "./logs/pm2-error.log" ]]; then
            print_status "Last 20 lines of PM2 error log:"
            tail -20 ./logs/pm2-error.log
        fi
    else
        print_warning "No local logs directory found"
    fi
}

# Function to check network connectivity
check_network_connectivity() {
    print_header "🌐 NETWORK CONNECTIVITY"
    
    # Check if port 3000 is accessible
    print_status "Checking port 3000..."
    if curl -f -s --connect-timeout 5 "http://localhost:3000/health" >/dev/null 2>&1; then
        print_success "Port 3000 is accessible"
        
        local response=$(curl -s "http://localhost:3000/health" 2>/dev/null)
        print_status "Health response: $response"
    else
        print_error "Port 3000 is not accessible"
        
        # Check if anything is listening on port 3000
        if netstat -tulpn 2>/dev/null | grep -q ":3000 "; then
            print_status "Something is listening on port 3000:"
            netstat -tulpn 2>/dev/null | grep ":3000 "
        else
            print_warning "Nothing is listening on port 3000"
        fi
    fi
    
    # Check Docker network
    print_status "Docker networks:"
    docker network ls
    
    # Check container ports
    if docker-compose ps | grep -q "pegasus-nest-api"; then
        print_status "Container port mappings:"
        docker-compose port app 3000 2>/dev/null || print_warning "No port mapping found"
    fi
}

# Function to check file system
check_file_system() {
    print_header "📁 FILE SYSTEM CHECK"
    
    # Check if required files exist
    local required_files=("package.json" "Dockerfile" "docker-compose.yml" "ecosystem.config.js")
    
    for file in "${required_files[@]}"; do
        if [[ -f "$file" ]]; then
            print_success "$file exists"
        else
            print_error "$file is missing"
        fi
    done
    
    # Check directories
    local required_dirs=("src" "generated" "logs" "resources")
    
    for dir in "${required_dirs[@]}"; do
        if [[ -d "$dir" ]]; then
            print_success "$dir directory exists"
            print_status "$dir permissions: $(ls -ld $dir | awk '{print $1, $3, $4}')"
        else
            print_error "$dir directory is missing"
        fi
    done
    
    # Check if dist directory exists (should be created during build)
    if [[ -d "dist" ]]; then
        print_success "dist directory exists"
        print_status "dist contents: $(ls -la dist/ | wc -l) files"
        if [[ -f "dist/main.js" ]]; then
            print_success "dist/main.js exists"
        else
            print_error "dist/main.js is missing"
        fi
    else
        print_warning "dist directory doesn't exist (needs build)"
    fi
    
    # Check environment file
    if [[ -f ".env" ]]; then
        print_success ".env file exists"
    else
        print_warning ".env file doesn't exist"
        if [[ -f ".env.docker.template" ]]; then
            print_status ".env.docker.template exists and can be copied"
        fi
    fi
}

# Function to check PM2 processes
check_pm2_processes() {
    print_header "⚙️ PM2 PROCESS CHECK"
    
    if docker-compose ps | grep -q "pegasus-nest-api"; then
        print_status "PM2 processes in container:"
        docker-compose exec -T app pm2 list 2>/dev/null || {
            print_warning "Could not list PM2 processes"
        }
        
        print_status "PM2 process details:"
        docker-compose exec -T app pm2 show pegasus-nest-api 2>/dev/null || {
            print_warning "Could not show PM2 process details"
        }
        
        print_status "PM2 environment:"
        docker-compose exec -T app pm2 env 0 2>/dev/null || {
            print_warning "Could not show PM2 environment"
        }
    else
        print_warning "No container running to check PM2"
    fi
}

# Function to run performance diagnostics
run_performance_diagnostics() {
    print_header "📊 PERFORMANCE DIAGNOSTICS"
    
    if curl -f -s "http://localhost:3000/health" >/dev/null 2>&1; then
        print_status "Testing health endpoints:"
        
        # Test basic health
        local health_response=$(curl -s "http://localhost:3000/health" 2>/dev/null)
        if [[ -n "$health_response" ]]; then
            print_success "Basic health endpoint working"
        else
            print_error "Basic health endpoint not responding"
        fi
        
        # Test memory health
        if curl -f -s "http://localhost:3000/health/memory" >/dev/null 2>&1; then
            print_success "Memory health endpoint working"
        else
            print_warning "Memory health endpoint not responding"
        fi
        
        # Test performance health
        if curl -f -s "http://localhost:3000/health/performance" >/dev/null 2>&1; then
            print_success "Performance health endpoint working"
        else
            print_warning "Performance health endpoint not responding"
        fi
        
        # Test database health
        if curl -f -s "http://localhost:3000/health/database" >/dev/null 2>&1; then
            print_success "Database health endpoint working"
        else
            print_warning "Database health endpoint not responding"
        fi
        
    else
        print_warning "Application not responding, skipping endpoint tests"
    fi
}

# Function to show recommendations
show_recommendations() {
    print_header "💡 RECOMMENDATIONS"
    
    echo -e "${CYAN}Based on the diagnostics, here are some recommendations:${NC}"
    echo ""
    
    # Check for common issues
    if ! docker-compose ps | grep -q "Up"; then
        echo -e "${YELLOW}• Container is not running - try: ./deploy.sh -c${NC}"
    fi
    
    if ! [[ -f "dist/main.js" ]]; then
        echo -e "${YELLOW}• Application not built - try: docker-compose build${NC}"
    fi
    
    if ! [[ -f ".env" ]]; then
        echo -e "${YELLOW}• Environment file missing - try: cp .env.docker.template .env${NC}"
    fi
    
    if ! curl -f -s "http://localhost:3000/health" >/dev/null 2>&1; then
        echo -e "${YELLOW}• Application not responding - check logs: docker-compose logs -f${NC}"
    fi
    
    echo ""
    echo -e "${CYAN}Quick fixes to try:${NC}"
    echo -e "${GREEN}1. Clean deploy:${NC} ./deploy.sh -c -p"
    echo -e "${GREEN}2. Check logs:${NC} docker-compose logs -f"
    echo -e "${GREEN}3. Restart container:${NC} docker-compose restart"
    echo -e "${GREEN}4. Manual build:${NC} docker-compose build --no-cache"
    echo -e "${GREEN}5. Stop and clean:${NC} docker-compose down -v && docker system prune -f"
    echo ""
}

# Main function
main() {
    print_header "🔧 PEGASUS NEST TROUBLESHOOTING TOOL"
    
    check_docker_status
    check_file_system
    check_container_status
    check_network_connectivity
    check_pm2_processes
    check_application_logs
    run_performance_diagnostics
    show_recommendations
    
    print_header "✅ DIAGNOSTICS COMPLETE"
    echo -e "${GREEN}Troubleshooting completed. Review the output above for issues and recommendations.${NC}"
}

# Run main function
main "$@"
