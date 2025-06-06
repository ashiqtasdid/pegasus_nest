#!/bin/bash

# Quick Manual Deploy Script for Pegasus Nest API
echo "🚀 Quick manual deployment to VPS..."

# Exit on any error
set -e

VPS_HOST="37.114.41.124"
VPS_USER="root"
DEPLOY_PATH="/opt/pegasus-nest"

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Check if .env file exists
if [ ! -f .env ]; then
    log "❌ ERROR: .env file not found!"
    log "🔧 Running environment setup..."
    ./setup-env.sh
    if [ $? -ne 0 ]; then
        log "❌ Environment setup failed!"
        exit 1
    fi
fi

# Validate environment file
log "🔍 Validating environment configuration..."
if ! grep -q "OPENROUTER_API_KEY=" .env || grep -q "OPENROUTER_API_KEY=your_api_key_here" .env; then
    log "❌ ERROR: Please configure OPENROUTER_API_KEY in .env file"
    log "Run ./setup-env.sh to configure environment variables"
    exit 1
fi

log "✅ Environment file validated"

# Copy files to VPS
log "📁 Copying files to VPS..."
rsync -avz --progress \
    --exclude-from='.gitignore' \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='dist' \
    --exclude='build' \
    --exclude='logs' \
    --exclude='generated' \
    ./ ${VPS_USER}@${VPS_HOST}:${DEPLOY_PATH}/

log "✅ Files copied successfully"

# Deploy on VPS
log "🔧 Running deployment on VPS..."
ssh ${VPS_USER}@${VPS_HOST} << 'EOF'
cd /opt/pegasus-nest

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Making scripts executable..."
chmod +x *.sh

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Running Docker BuildKit fix..."
if [ -f fix-docker-buildkit.sh ]; then
    ./fix-docker-buildkit.sh
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Running Node.js conflict fix..."
if [ -f fix-nodejs-conflict.sh ]; then
    ./fix-nodejs-conflict.sh
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting deployment..."
./deploy-vps.sh

echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ Deployment completed!"
EOF

# Verify deployment
log "🔍 Verifying deployment..."
sleep 10

if curl -f http://${VPS_HOST}:3000/health 2>/dev/null; then
    log "✅ Health check passed!"
    log "🎉 Deployment successful!"
    echo ""
    echo "✅ Pegasus Nest API is running at http://${VPS_HOST}:3000"
    echo "📊 Health endpoint: http://${VPS_HOST}:3000/health"
    echo "📝 Check logs: ssh ${VPS_USER}@${VPS_HOST} 'cd ${DEPLOY_PATH} && docker-compose logs -f'"
else
    log "❌ Health check failed!"
    log "Check logs with: ssh ${VPS_USER}@${VPS_HOST} 'cd ${DEPLOY_PATH} && docker-compose logs'"
    exit 1
fi
