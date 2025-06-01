#!/bin/bash

# Update environment variables script
# Run this script on your VPS to update production environment variables

echo "🔧 Updating Pegasus Nest environment variables..."

# Navigate to the project directory
cd /opt/pegasus-nest

# Backup current .env.production
cp .env.production .env.production.backup

# Update environment variables
echo "Enter your OpenRouter API Key:"
read -s OPENROUTER_API_KEY

echo "Enter your domain name (e.g., yourdomain.com):"
read DOMAIN_NAME

echo "Enter your email for SSL certificates:"
read EMAIL

# Create updated .env.production
cat > .env.production << EOF
# Production Environment Variables
NODE_ENV=production
PORT=3000

# API Configuration
OPENROUTER_API_KEY=${OPENROUTER_API_KEY}

# Site Configuration
SITE_URL=https://api.${DOMAIN_NAME}
SITE_NAME=Pegasus API
CORS_ORIGIN=https://app.${DOMAIN_NAME}

# Features
AI_FIXING_ENABLED=true
AUTO_FIX_ENABLED=true
DEBUG_AI_PROMPTS=false

# Database (if needed)
# DATABASE_URL=your_database_url_here

# SSL/Security
SSL_CERT_PATH=/etc/nginx/ssl/fullchain.pem
SSL_KEY_PATH=/etc/nginx/ssl/privkey.pem

# Rate Limiting
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=900000

# Logging
LOG_LEVEL=info
LOG_FILE=/var/log/pegasus-nest/app.log
EOF

echo "✅ Environment variables updated!"
echo "🔄 Restarting Docker containers..."

# Restart the containers to pick up new environment variables
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d

echo "✅ Deployment updated successfully!"
echo "🌐 Your API should be available at: https://api.${DOMAIN_NAME}"
echo "🌐 Your UI should be available at: https://app.${DOMAIN_NAME}"
