#!/bin/bash

# Pegasus Nest API - Linux Deployment Script
# This script builds and deploys the application using Docker

set -e  # Exit on any error

echo "🚀 Starting Pegasus Nest API deployment..."

# Check if .env.production exists
if [ ! -f .env.production ]; then
    echo "❌ .env.production file not found!"
    echo "Please create .env.production with your environment variables"
    exit 1
fi

# Check if OPENROUTER_API_KEY is set
if ! grep -q "OPENROUTER_API_KEY=" .env.production; then
    echo "❌ OPENROUTER_API_KEY not found in .env.production!"
    echo "Please add your OpenRouter API key to .env.production"
    exit 1
fi

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker-compose -f docker-compose.yml down || true

# Build and start new containers
echo "🔨 Building and starting containers..."
docker-compose -f docker-compose.yml up --build -d

# Check if containers are running
echo "🔍 Checking container status..."
sleep 5
if docker-compose ps | grep -q "Up"; then
    echo "✅ Deployment successful!"
    echo "🌐 API is running at: http://localhost:3001"
    echo "📊 Health check: http://localhost:3001/health"
    echo "🎛️ Admin UI: http://localhost:3001/ui"
else
    echo "❌ Deployment failed!"
    echo "Container logs:"
    docker-compose logs
    exit 1
fi

echo "🎉 Pegasus Nest API deployment complete!"