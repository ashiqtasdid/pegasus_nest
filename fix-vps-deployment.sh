#!/bin/bash
# fix-vps-deployment.sh - Script to fix deployment issues on VPS
# Run this directly on the VPS to fix Node.js installation and redeploy

set -e
LOG_FILE="/opt/pegasus-nest/deployment-fix.log"

log() {
  local timestamp=$(date +"%Y-%m-%d %H:%M:%S")
  echo "[$timestamp] $1" | tee -a "$LOG_FILE"
}

log "🔧 Starting VPS deployment fix..."

# Fix Node.js installation
log "1. Fixing Node.js installation"
apt-get remove -y nodejs libnode-dev || true
apt-get autoremove -y
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Verify Node.js installation
log "2. Verifying Node.js installation"
node -v
npm -v

# Install pnpm
log "3. Installing pnpm@8.15.8"
npm install -g pnpm@8.15.8
pnpm -v

# Fix environment files
log "4. Fixing environment files"
cd /opt/pegasus-nest

# Fix backend .env file
cat > .env << 'EOL'
NODE_ENV=production
OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
PORT=3000
EOL

# Fix frontend .env.local file
mkdir -p frontend
cat > frontend/.env.local << 'EOL'
NODE_ENV=production
NEXT_PUBLIC_API_URL=http://37.114.41.124
MONGODB_URL=${MONGODB_URL}
GITHUB_CLIENT_ID=${GITHUB_CLIENT_ID}
GITHUB_CLIENT_SECRET=${GITHUB_CLIENT_SECRET}
BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET}
BETTER_AUTH_URL=http://37.114.41.124
EOL

log "5. Starting deployment"
# Make deploy script executable
chmod +x deploy-vps.sh

# Run the deployment script
./deploy-vps.sh

log "🏁 Deployment fix completed!"
