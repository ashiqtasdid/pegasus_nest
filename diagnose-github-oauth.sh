#!/bin/bash

# OAuth configuration diagnostic script
# This script checks if GitHub OAuth is properly configured

echo "🔍 GitHub OAuth Configuration Diagnostic"
echo "========================================="

# Check environment variables
echo "Checking environment variables..."
ENV_FILE="frontend/.env.local"

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ ERROR: $ENV_FILE does not exist"
  exit 1
fi

# Extract values (safely)
GITHUB_CLIENT_ID=$(grep "GITHUB_CLIENT_ID=" "$ENV_FILE" | cut -d '=' -f2)
GITHUB_CLIENT_SECRET=$(grep "GITHUB_CLIENT_SECRET=" "$ENV_FILE" | cut -d '=' -f2)
BETTER_AUTH_SECRET=$(grep "BETTER_AUTH_SECRET=" "$ENV_FILE" | cut -d '=' -f2)
BETTER_AUTH_URL=$(grep "BETTER_AUTH_URL=" "$ENV_FILE" | cut -d '=' -f2)

# Check GitHub OAuth credentials
if [ -z "$GITHUB_CLIENT_ID" ] || [ "$GITHUB_CLIENT_ID" = "placeholder" ]; then
  echo "❌ GITHUB_CLIENT_ID is missing or set to placeholder"
  OAUTH_CONFIGURED=false
else
  echo "✅ GITHUB_CLIENT_ID is set"
  OAUTH_CONFIGURED=true
fi

if [ -z "$GITHUB_CLIENT_SECRET" ] || [ "$GITHUB_CLIENT_SECRET" = "placeholder" ]; then
  echo "❌ GITHUB_CLIENT_SECRET is missing or set to placeholder"
  OAUTH_CONFIGURED=false
else
  echo "✅ GITHUB_CLIENT_SECRET is set"
  OAUTH_CONFIGURED=true
fi

if [ -z "$BETTER_AUTH_SECRET" ]; then
  echo "❌ BETTER_AUTH_SECRET is missing"
else
  echo "✅ BETTER_AUTH_SECRET is set"
fi

if [ -z "$BETTER_AUTH_URL" ]; then
  echo "❌ BETTER_AUTH_URL is missing"
else
  echo "✅ BETTER_AUTH_URL is set to: $BETTER_AUTH_URL"
fi

# Summary
echo ""
echo "GitHub OAuth Status Summary:"
echo "---------------------------"
if [ "$OAUTH_CONFIGURED" = true ]; then
  echo "✅ GitHub OAuth appears to be properly configured"
else
  echo "❌ GitHub OAuth is NOT properly configured"
  echo ""
  echo "Please ensure your GitHub OAuth credentials are properly set in $ENV_FILE"
  echo "These can be created at: https://github.com/settings/developers"
  echo ""
  echo "Make sure you set the callback URL to: $BETTER_AUTH_URL/api/auth/callback/github"
fi

# Check if better-auth is installed
if [ -d "frontend/node_modules/better-auth" ]; then
  echo "✅ better-auth package is installed"
else
  echo "❌ better-auth package is NOT installed"
fi

echo ""
echo "Diagnostic complete"
