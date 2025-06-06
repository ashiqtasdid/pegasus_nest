#!/bin/bash

# Script to verify environment variables are correctly loaded in containers

echo "🔍 Verifying environment variables in containers..."

# Check if frontend container is running
if ! docker ps | grep -q pegasus-nest-frontend; then
  echo "❌ Frontend container is not running"
  exit 1
fi

# Check if backend container is running
if ! docker ps | grep -q pegasus-nest-api; then
  echo "❌ Backend container is not running"
  exit 1
fi

echo "✅ Both containers are running"

# Check frontend environment variables
echo -e "\n📋 Frontend container environment variables:"
docker exec pegasus-nest-frontend env | grep -E 'NODE_ENV|MONGODB|GITHUB|BETTER_AUTH' | grep -v SECRET

# Check if GitHub OAuth credentials are set
if ! docker exec pegasus-nest-frontend env | grep -q GITHUB_CLIENT_ID; then
  echo "❌ GITHUB_CLIENT_ID is missing in frontend container"
else
  echo "✅ GITHUB_CLIENT_ID is set in frontend container"
fi

if ! docker exec pegasus-nest-frontend env | grep -q GITHUB_CLIENT_SECRET; then
  echo "❌ GITHUB_CLIENT_SECRET is missing in frontend container"
else
  echo "✅ GITHUB_CLIENT_SECRET is set in frontend container"
fi

# Check if required files exist in the frontend container
echo -e "\n📋 Checking frontend container files:"
if docker exec pegasus-nest-frontend ls /app/server.js > /dev/null 2>&1; then
  echo "✅ Frontend server file exists"
else
  echo "❌ Frontend server file is missing"
fi

# Check if auth routes are accessible
echo -e "\n📋 Testing auth endpoints:"
# Test session endpoint
if curl -s -o /dev/null -w "%{http_code}" http://localhost/api/auth/get-session | grep -q "200"; then
  echo "✅ /api/auth/get-session endpoint is accessible"
else
  echo "❌ /api/auth/get-session endpoint is not accessible"
fi

# Test GitHub OAuth endpoint
GITHUB_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/api/auth/sign-in/github)
if [ "$GITHUB_RESPONSE" = "302" ]; then
  echo "✅ /api/auth/sign-in/github endpoint is correctly redirecting (302)"
elif [ "$GITHUB_RESPONSE" = "200" ]; then
  echo "✅ /api/auth/sign-in/github endpoint is responding (200)"
else
  echo "❌ /api/auth/sign-in/github endpoint returned status: $GITHUB_RESPONSE"
fi

echo -e "\n✨ Environment verification complete"
