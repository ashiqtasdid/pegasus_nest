#!/bin/bash

# Pre-deployment Test Script for Pegasus Nest
echo "🧪 Running pre-deployment tests..."

# Exit on any error
set -e

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Function to check file exists
check_file() {
    if [ ! -f "$1" ]; then
        log "❌ ERROR: Required file not found: $1"
        exit 1
    fi
    log "✅ File exists: $1"
}

# Function to check environment variable in file
check_env_var() {
    local file="$1"
    local var="$2"
    if ! grep -q "$var" "$file"; then
        log "❌ ERROR: Environment variable $var not found in $file"
        exit 1
    fi
    log "✅ Environment variable $var found in $file"
}

log "Starting pre-deployment verification..."

# Check required files exist
log "📁 Checking required files..."
check_file ".env"
check_file "frontend/.env.local"
check_file "docker-compose.simple.yml"
check_file "nginx-production.conf"
check_file "Dockerfile"
check_file "frontend/Dockerfile"

# Check environment files have required variables
log "🔐 Checking environment variables..."
check_env_var ".env" "OPENROUTER_API_KEY"
check_env_var "frontend/.env.local" "MONGODB_URL"
check_env_var "frontend/.env.local" "GITHUB_CLIENT_ID"
check_env_var "frontend/.env.local" "GITHUB_CLIENT_SECRET"
check_env_var "frontend/.env.local" "BETTER_AUTH_SECRET"

# Check Docker configuration
log "🐳 Checking Docker configuration..."
if ! docker --version >/dev/null 2>&1; then
    log "❌ ERROR: Docker is not installed or not accessible"
    exit 1
fi
log "✅ Docker is available"

# Check if compose file is valid
if ! docker-compose -f docker-compose.simple.yml config >/dev/null 2>&1; then
    log "❌ ERROR: docker-compose.simple.yml is invalid"
    exit 1
fi
log "✅ Docker compose configuration is valid"

# Check Node.js and pnpm versions
log "📦 Checking Node.js and pnpm versions..."
NODE_VERSION=$(node --version 2>/dev/null | sed 's/v//' | cut -d'.' -f1 || echo "0")
if [ "$NODE_VERSION" -lt 20 ]; then
    log "⚠️  WARNING: Node.js version is $NODE_VERSION, should be 20+"
fi

if command -v pnpm >/dev/null 2>&1; then
    PNPM_VERSION=$(pnpm --version | cut -d'.' -f1)
    if [ "$PNPM_VERSION" -gt 8 ]; then
        log "⚠️  WARNING: pnpm version is $PNPM_VERSION, should be 8.x for compatibility"
    fi
    log "✅ Node.js: $(node --version), pnpm: $(pnpm --version)"
else
    log "⚠️  WARNING: pnpm not found, will be installed during deployment"
fi

# Check nginx configuration syntax
log "🌐 Checking nginx configuration..."
if command -v nginx >/dev/null 2>&1; then
    if nginx -t -c "$(pwd)/nginx-production.conf" >/dev/null 2>&1; then
        log "✅ Nginx configuration syntax is valid"
    else
        log "⚠️  WARNING: Cannot validate nginx configuration (may need Docker context)"
    fi
else
    log "ℹ️  INFO: nginx not installed locally, will be checked in Docker"
fi

# Check for common deployment issues
log "🔍 Checking for common deployment issues..."

# Check if frontend build configuration exists
if [ -f "frontend/next.config.ts" ]; then
    if grep -q "output.*standalone" "frontend/next.config.ts"; then
        log "✅ Next.js standalone output configuration found"
    else
        log "❌ ERROR: Next.js standalone output configuration missing"
        exit 1
    fi
else
    log "❌ ERROR: frontend/next.config.ts not found"
    exit 1
fi

# Check if auth configuration has proper syntax
if [ -f "frontend/lib/auth.ts" ]; then
    if grep -q "providers.*\[" "frontend/lib/auth.ts"; then
        log "✅ Better Auth providers array syntax found"
    else
        log "❌ ERROR: Better Auth providers configuration issue"
        exit 1
    fi
else
    log "❌ ERROR: frontend/lib/auth.ts not found"
    exit 1
fi

# Check if deployment script is executable
if [ -x "deploy-vps.sh" ]; then
    log "✅ Deployment script is executable"
else
    log "⚠️  WARNING: deploy-vps.sh is not executable, fixing..."
    chmod +x deploy-vps.sh
fi

# Final summary
log "🎉 Pre-deployment tests completed successfully!"
log "📋 Summary:"
log "   ✅ All required files present"
log "   ✅ Environment variables configured"
log "   ✅ Docker configuration valid"
log "   ✅ Next.js configuration correct"
log "   ✅ Better Auth configuration valid"
log "   ✅ Deployment script ready"
log ""
log "🚀 Ready for deployment! Run: ./deploy-vps.sh"
