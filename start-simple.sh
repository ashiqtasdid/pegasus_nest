#!/bin/bash

# Simple startup script without PM2
echo "🚀 Starting Pegasus Nest in Simple Mode (without PM2)"
echo "====================================================="

# Check if build exists
if [ ! -d "dist" ]; then
    echo "📦 Building application..."
    npm run build
fi

# Set environment variables
export NODE_ENV=production
export PORT=3000

# Start the application directly with Node.js
echo "🏃 Starting application on port 3000..."
node dist/main.js

# Simple Node.js startup script for debugging
# This runs the application directly without PM2 for easier debugging

echo "🚀 Starting Pegasus Nest API in debug mode..."

# Set environment variables
export NODE_ENV=${NODE_ENV:-production}
export PORT=${PORT:-3000}
export LOG_LEVEL=${LOG_LEVEL:-info}

echo "Environment: $NODE_ENV"
echo "Port: $PORT"
echo "Log Level: $LOG_LEVEL"

# Check if main.js exists
if [ ! -f "dist/main.js" ]; then
    echo "❌ Error: dist/main.js not found!"
    echo "Building application..."
    npm run build
    
    if [ ! -f "dist/main.js" ]; then
        echo "❌ Build failed! dist/main.js still not found!"
        exit 1
    fi
fi

echo "✅ dist/main.js found"

# Create logs directory
mkdir -p logs

# Start the application
echo "🎯 Starting Node.js application directly..."
node dist/main.js
