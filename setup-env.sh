#!/bin/bash

# Environment Setup Script for Pegasus Nest API
echo "🔧 Setting up environment for Pegasus Nest API..."

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Function to prompt for environment variable
prompt_env_var() {
    local var_name="$1"
    local var_description="$2"
    local default_value="$3"
    local is_secret="$4"
    
    if [ -n "$default_value" ]; then
        read -p "Enter $var_description [$default_value]: " value
        if [ -z "$value" ]; then
            value="$default_value"
        fi
    else
        if [ "$is_secret" = "true" ]; then
            read -s -p "Enter $var_description: " value
            echo
        else
            read -p "Enter $var_description: " value
        fi
    fi
    
    echo "$var_name=$value"
}

# Check if .env already exists
if [ -f ".env" ]; then
    log "⚠️  .env file already exists!"
    read -p "Do you want to recreate it? (y/N): " recreate
    if [ "$recreate" != "y" ] && [ "$recreate" != "Y" ]; then
        log "✅ Keeping existing .env file"
        exit 0
    fi
    log "🗑️  Backing up existing .env to .env.backup"
    cp .env .env.backup
fi

log "📝 Creating new .env file..."

# Create .env file
cat > .env << EOF
# Pegasus Nest API Environment Configuration
# Generated on $(date)

# Application Environment
NODE_ENV=production

# Server Configuration
PORT=3000

# API Keys
EOF

# Prompt for OpenRouter API Key
echo ""
log "🔑 OpenRouter API Key is required for the AI functionality"
log "You can get your API key from: https://openrouter.ai/keys"
echo ""
openrouter_key=$(prompt_env_var "OPENROUTER_API_KEY" "OpenRouter API Key" "" "true")
echo "$openrouter_key" >> .env

# Add optional configurations
echo "" >> .env
echo "# Optional Configuration" >> .env
echo "# LOG_LEVEL=info" >> .env
echo "# API_RATE_LIMIT=100" >> .env
echo "# CORS_ORIGIN=*" >> .env

log "✅ Environment file created successfully!"
log "📄 Review your .env file and modify if needed"

# Validate the .env file
echo ""
log "🔍 Validating environment configuration..."

if grep -q "OPENROUTER_API_KEY=your_api_key_here" .env || grep -q "OPENROUTER_API_KEY=$" .env; then
    log "❌ ERROR: Please set a valid OpenRouter API key!"
    log "Edit .env file and replace the placeholder with your actual API key"
    exit 1
fi

if grep -q "OPENROUTER_API_KEY=" .env; then
    log "✅ OpenRouter API key is configured"
else
    log "❌ ERROR: OpenRouter API key is missing!"
    exit 1
fi

log "✅ Environment validation passed!"
log ""
log "🚀 Your environment is ready for deployment!"
log "Next steps:"
log "  1. Review .env file: cat .env"
log "  2. Deploy to VPS: ./quick-deploy.sh"
log "  3. Or deploy manually: see MANUAL_DEPLOYMENT.md"
