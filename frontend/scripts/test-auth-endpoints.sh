#!/bin/bash

# Script to test authentication endpoints
# Run this after frontend container is up to validate endpoints

echo "🧪 Testing authentication endpoints..."
sleep 5  # Wait for the server to fully start

# Base URL
BASE_URL="http://localhost:3000"

# Function to check endpoint
check_endpoint() {
  local endpoint="$1"
  local expected_status="$2"
  local method="${3:-GET}"
  
  echo -n "Testing $method $endpoint... "
  
  # Use curl to check the endpoint
  status=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$BASE_URL$endpoint")
  
  if [ "$status" = "$expected_status" ]; then
    echo "✅ OK ($status)"
    return 0
  else
    echo "❌ FAILED (got $status, expected $expected_status)"
    return 1
  fi
}

# Check endpoints
check_endpoint "/api/auth/get-session" "200"
check_endpoint "/api/auth/sign-in/email" "405" "GET"  # Should be POST method only
check_endpoint "/api/auth/sign-in/github" "302"       # Should redirect to GitHub

# Check GitHub OAuth is configured
echo -n "Checking GitHub OAuth configuration... "
if curl -s "$BASE_URL/api/auth/sign-in/github" | grep -q "Social provider github is missing clientId or clientSecret"; then
  echo "❌ FAILED - GitHub OAuth credentials missing"
  exit 1
else
  echo "✅ OK"
fi

echo "✨ Authentication endpoint tests completed"
