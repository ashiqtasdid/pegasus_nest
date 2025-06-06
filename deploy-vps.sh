#!/bin/bash

# VPS Deployment Script for Pegasus Nest
echo "🚀 Starting Pegasus Nest deployment on VPS..."

# Stop existing containers
echo "Stopping existing containers..."
docker-compose -f docker-compose.simple.yml down 2>/dev/null || true

# Remove old images to save space
echo "Cleaning up old images..."
docker system prune -f

# Pull latest images if needed
echo "Pulling base images..."
docker pull node:20-alpine
docker pull nginx:alpine

# Build and start services
echo "Building and starting services..."
docker-compose -f docker-compose.simple.yml up --build -d

# Wait for services to be ready
echo "Waiting for services to start..."
sleep 10

# Show running containers
echo "Deployment complete! Running containers:"
docker ps

# Test health endpoint
echo "Testing application health..."
for i in {1..30}; do
  if curl -f http://localhost/health 2>/dev/null || curl -f http://localhost 2>/dev/null; then
    echo "✅ Application is healthy!"
    break
  fi
  echo "Waiting for application to be ready... ($i/30)"
  sleep 2
done

echo "✅ Pegasus Nest is now running at http://37.114.41.124"
echo "📝 Check logs with: docker-compose -f docker-compose.simple.yml logs -f"
