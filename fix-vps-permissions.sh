#!/bin/bash

# Fix VPS Docker Permissions for Pegasus Nest
# Run this script on your VPS to fix the permission issues

echo "🔧 Fixing Docker volume permissions on VPS..."

# Create directories if they don't exist
sudo mkdir -p ./generated
sudo mkdir -p ./logs

# Get the node user ID from the Docker container
NODE_UID=$(docker run --rm node:18-alpine id -u node)
NODE_GID=$(docker run --rm node:18-alpine id -g node)

echo "📋 Node user UID: $NODE_UID"
echo "📋 Node user GID: $NODE_GID"

# Change ownership of the directories to match the node user in the container
sudo chown -R $NODE_UID:$NODE_GID ./generated
sudo chown -R $NODE_UID:$NODE_GID ./logs

# Set proper permissions
sudo chmod -R 755 ./generated
sudo chmod -R 755 ./logs

echo "✅ Permissions fixed!"
echo "📁 Generated directory: $(ls -la ./generated)"
echo "📁 Logs directory: $(ls -la ./logs)"

# Restart the Docker containers to apply changes
echo "🔄 Restarting Docker containers..."
docker-compose down
docker-compose up -d

echo "🚀 Pegasus Nest should now be running with proper permissions!"
echo "🔗 Test the API: curl http://localhost:3000/health"
