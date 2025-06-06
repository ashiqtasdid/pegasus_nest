#!/bin/bash

# Script to verify the auth environment variables at container startup

echo "Checking authentication environment variables..."

# Check Better Auth secret
if [ -z "$BETTER_AUTH_SECRET" ] || [ "$BETTER_AUTH_SECRET" = "placeholder" ]; then
  echo "⚠️ WARNING: BETTER_AUTH_SECRET is not set or is a placeholder"
else
  echo "✅ BETTER_AUTH_SECRET is configured"
fi

# Check GitHub OAuth credentials
if [ -z "$GITHUB_CLIENT_ID" ] || [ "$GITHUB_CLIENT_ID" = "placeholder" ]; then
  echo "⚠️ WARNING: GITHUB_CLIENT_ID is not set or is a placeholder"
else
  echo "✅ GITHUB_CLIENT_ID is configured"
fi

if [ -z "$GITHUB_CLIENT_SECRET" ] || [ "$GITHUB_CLIENT_SECRET" = "placeholder" ]; then
  echo "⚠️ WARNING: GITHUB_CLIENT_SECRET is not set or is a placeholder"
else
  echo "✅ GITHUB_CLIENT_SECRET is configured"
fi

# Check MongoDB URL
if [ -z "$MONGODB_URL" ] || [ "$MONGODB_URL" = "placeholder" ]; then
  echo "⚠️ WARNING: MONGODB_URL is not set or is a placeholder"
else
  echo "✅ MONGODB_URL is configured"
fi

# Check Better Auth URL
if [ -z "$BETTER_AUTH_URL" ]; then
  echo "⚠️ WARNING: BETTER_AUTH_URL is not set, using default"
else
  echo "✅ BETTER_AUTH_URL is set to $BETTER_AUTH_URL"
fi

echo "Environment validation complete"
