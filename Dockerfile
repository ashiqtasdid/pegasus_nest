# Backend Dockerfile
FROM node:20-alpine

# Create app directory
WORKDIR /app

# Install necessary build tools and dependencies
RUN apk add --no-cache python3 make g++ curl openjdk17 maven

# Install specific pnpm version compatible with lockfile v9.0
RUN npm install -g pnpm@9.15.0

# Install PM2 globally for production process management
RUN npm install -g pm2

# Verify installations
RUN pnpm --version && pm2 --version

# Copy package files first (better layer caching)
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile --production=false

# Copy application source
COPY . .

# Build the application
RUN pnpm run build

# Create directories for generated plugins and logs with proper permissions
RUN mkdir -p /app/generated /app/logs /app/resources

# Copy ecosystem config for PM2 - use Docker-optimized version
COPY ecosystem.docker.config.js ./ecosystem.config.js

# Create a startup script for better error handling
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'echo "Starting Pegasus Nest API..."' >> /app/start.sh && \
    echo 'echo "Node version: $(node --version)"' >> /app/start.sh && \
    echo 'echo "PM2 version: $(pm2 --version)"' >> /app/start.sh && \
    echo 'echo "Working directory: $(pwd)"' >> /app/start.sh && \
    echo 'echo "Files in directory: $(ls -la)"' >> /app/start.sh && \
    echo 'echo "Environment: $NODE_ENV"' >> /app/start.sh && \
    echo 'echo "Port: $PORT"' >> /app/start.sh && \
    echo '' >> /app/start.sh && \
    echo '# Ensure logs directory exists' >> /app/start.sh && \
    echo 'mkdir -p /app/logs' >> /app/start.sh && \
    echo '' >> /app/start.sh && \
    echo '# Check if main.js exists' >> /app/start.sh && \
    echo 'if [ ! -f "dist/main.js" ]; then' >> /app/start.sh && \
    echo '  echo "ERROR: dist/main.js not found!"' >> /app/start.sh && \
    echo '  echo "Contents of dist directory:"' >> /app/start.sh && \
    echo '  ls -la dist/' >> /app/start.sh && \
    echo '  exit 1' >> /app/start.sh && \
    echo 'fi' >> /app/start.sh && \
    echo '' >> /app/start.sh && \
    echo '# Start PM2 with error handling' >> /app/start.sh && \
    echo 'echo "Starting PM2..."' >> /app/start.sh && \
    echo 'pm2-runtime start ecosystem.config.js --env production' >> /app/start.sh && \
    chmod +x /app/start.sh

# Change ownership to node user for security and ensure proper permissions
RUN chown -R node:node /app && \
    chmod -R 755 /app/generated /app/logs /app/resources

USER node

# Expose the port the app runs on
EXPOSE 3000

# Health check - simplified and more reliable
HEALTHCHECK --interval=30s --timeout=15s --start-period=60s --retries=5 \
  CMD curl -f http://localhost:3000/health || exit 1

# Command to run the application with better error handling
CMD ["/app/start.sh"]