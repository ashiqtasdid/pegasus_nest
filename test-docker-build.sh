#!/bin/bash

# Local test script for Docker build issues
echo "🧪 Testing Docker builds locally..."

# Set variables
export DOCKER_BUILDKIT=0

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Test 1: Try building with pnpm
log "Testing pnpm build..."
if docker build -t pegasus-nest-test-pnpm -f Dockerfile .; then
    log "✅ pnpm build successful"
    PNPM_SUCCESS=true
else
    log "❌ pnpm build failed"
    PNPM_SUCCESS=false
fi

# Test 2: Try building with npm
log "Testing npm build..."
if docker build -t pegasus-nest-test-npm -f Dockerfile.npm .; then
    log "✅ npm build successful"
    NPM_SUCCESS=true
else
    log "❌ npm build failed"
    NPM_SUCCESS=false
fi

# Summary
log "=== BUILD TEST SUMMARY ==="
if [ "$PNPM_SUCCESS" = true ]; then
    log "✅ pnpm build: SUCCESS"
else
    log "❌ pnpm build: FAILED"
fi

if [ "$NPM_SUCCESS" = true ]; then
    log "✅ npm build: SUCCESS"
else
    log "❌ npm build: FAILED"
fi

# Clean up test images
log "Cleaning up test images..."
docker rmi pegasus-nest-test-pnpm 2>/dev/null || true
docker rmi pegasus-nest-test-npm 2>/dev/null || true

if [ "$PNPM_SUCCESS" = true ] || [ "$NPM_SUCCESS" = true ]; then
    log "🎉 At least one build method works! Ready for deployment."
    exit 0
else
    log "💥 Both build methods failed. Check Docker setup."
    exit 1
fi
