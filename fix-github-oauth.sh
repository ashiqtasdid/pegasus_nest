#!/bin/bash

# Script to fix GitHub OAuth issues in the frontend container

echo "🔧 GitHub OAuth Fix for Frontend Container"
echo "=========================================="

# Check if container is running
if ! docker ps | grep -q pegasus-nest-frontend; then
  echo "❌ Frontend container is not running"
  echo "Please start the container first"
  exit 1
fi

echo "✅ Frontend container is running"

# Connect to container and check environment variables
echo -e "\nChecking environment variables inside container..."
docker exec pegasus-nest-frontend env | grep -E 'GITHUB_CLIENT|BETTER_AUTH|MONGODB'

# Check if GitHub OAuth variables are set
if ! docker exec pegasus-nest-frontend env | grep -q GITHUB_CLIENT_ID; then
  echo "❌ GITHUB_CLIENT_ID is not set in the container"
  NEEDS_FIX=true
else
  echo "✅ GITHUB_CLIENT_ID is set in the container"
fi

if ! docker exec pegasus-nest-frontend env | grep -q GITHUB_CLIENT_SECRET; then
  echo "❌ GITHUB_CLIENT_SECRET is not set in the container"
  NEEDS_FIX=true
else
  echo "✅ GITHUB_CLIENT_SECRET is set in the container"
fi

# Fix environment variables if needed
if [ "$NEEDS_FIX" = true ]; then
  echo -e "\n⚙️ Fixing GitHub OAuth environment variables..."
  
  # Get environment variables from local .env.local file
  if [ ! -f frontend/.env.local ]; then
    echo "❌ frontend/.env.local file not found"
    echo "Please create this file with the required variables"
    exit 1
  fi
  
  # Extract values
  GITHUB_CLIENT_ID=$(grep GITHUB_CLIENT_ID frontend/.env.local | cut -d= -f2)
  GITHUB_CLIENT_SECRET=$(grep GITHUB_CLIENT_SECRET frontend/.env.local | cut -d= -f2)
  BETTER_AUTH_SECRET=$(grep BETTER_AUTH_SECRET frontend/.env.local | cut -d= -f2)
  BETTER_AUTH_URL=$(grep BETTER_AUTH_URL frontend/.env.local | cut -d= -f2)
  
  if [ -z "$GITHUB_CLIENT_ID" ] || [ -z "$GITHUB_CLIENT_SECRET" ]; then
    echo "❌ GitHub OAuth credentials not found in frontend/.env.local"
    exit 1
  fi
  
  echo "Found GitHub OAuth credentials in frontend/.env.local"
  
  # Restart the container with environment variables
  echo "Restarting frontend container with correct environment variables..."
  
  # Stop the container
  docker stop pegasus-nest-frontend
  
  # Remove the container
  docker rm pegasus-nest-frontend
  
  # Start the container with environment variables
  docker run -d \
    --name pegasus-nest-frontend \
    --network pegasus-nest_pegasus-network \
    -p 3003:3000 \
    -e GITHUB_CLIENT_ID="$GITHUB_CLIENT_ID" \
    -e GITHUB_CLIENT_SECRET="$GITHUB_CLIENT_SECRET" \
    -e BETTER_AUTH_SECRET="$BETTER_AUTH_SECRET" \
    -e BETTER_AUTH_URL="$BETTER_AUTH_URL" \
    -e MONGODB_URL="$(grep MONGODB_URL frontend/.env.local | cut -d= -f2)" \
    pegasus-nest-frontend
    
  echo "✅ Frontend container restarted with correct environment variables"
else
  echo -e "\n✅ GitHub OAuth environment variables are already set correctly"
fi

# Verify auth endpoints are working
echo -e "\nVerifying auth endpoints..."
if ! curl -s http://localhost:3003/api/auth/sign-in/github -o /dev/null; then
  echo "❌ Failed to access /api/auth/sign-in/github endpoint"
else
  echo "✅ Successfully accessed /api/auth/sign-in/github endpoint"
fi

echo -e "\n🎉 GitHub OAuth fix completed"
echo "You should now be able to sign in with GitHub"
