#!/bin/bash

# Fix VPS Docker Permissions Script
# Run this script on your VPS server to fix the Docker volume permission issues

echo "🔧 Fixing Docker volume permissions on VPS..."

# Stop any running containers
echo "Stopping containers..."
docker-compose down

# Create directories with proper permissions
echo "Creating directories with proper permissions..."
mkdir -p generated logs
sudo chown -R 1000:1000 generated logs
sudo chmod -R 755 generated logs

# Alternative: If the above doesn't work, try this more permissive approach
echo "Setting permissive permissions as fallback..."
sudo chmod -R 777 generated logs

# Restart containers
echo "Starting containers with fixed permissions..."
docker-compose up -d

echo "✅ Docker permissions fixed!"
echo "📝 Check logs with: docker-compose logs -f"
echo "🧪 Test API with: curl http://localhost:3000/health"
