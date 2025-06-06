#!/bin/bash
# fix-frontend-container.sh
# Run this script to fix the pegasus-nest-frontend container conflict

echo "🛠️ Fixing frontend container conflict..."

# Stop and remove the conflicting container
echo "Removing conflicting frontend container..."
docker ps -a | grep pegasus-nest-frontend && docker rm -f pegasus-nest-frontend

# Restart the deployment
echo "Restarting deployment..."
cd /opt/pegasus-nest
chmod +x deploy-vps.sh
./deploy-vps.sh

echo "Done! Check container status with: docker ps"
