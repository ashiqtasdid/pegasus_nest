#!/bin/bash
# clean-docker-containers.sh
# This script forcefully removes all Pegasus Nest containers and networks
# Run this script when you encounter container name conflicts

set -e

echo "🧹 Cleaning up Docker containers and networks for Pegasus Nest..."

# Stop and remove any running containers with our names
echo "Stopping and removing all Pegasus containers..."
docker ps -a | grep pegasus-nest-api && docker rm -f pegasus-nest-api || echo "No pegasus-nest-api container found"
docker ps -a | grep pegasus-nest-frontend && docker rm -f pegasus-nest-frontend || echo "No pegasus-nest-frontend container found" 
docker ps -a | grep pegasus-ui && docker rm -f pegasus-ui || echo "No pegasus-ui container found"
docker ps -a | grep pegasus-nginx && docker rm -f pegasus-nginx || echo "No pegasus-nginx container found"

# Remove any networks
echo "Removing Pegasus networks..."
docker network ls | grep pegasus-network && docker network rm pegasus-nest_pegasus-network || echo "No pegasus-network found"

# Prune networks
echo "Pruning unused Docker networks..."
docker network prune -f

# Check for any remaining containers
echo "Checking for any remaining Pegasus containers..."
docker ps -a | grep -i pegasus || echo "No Pegasus containers found"

echo "Cleanup completed!"
echo "You can now run deploy-vps.sh to start the services"
