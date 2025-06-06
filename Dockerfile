# Backend Dockerfile
FROM node:20-alpine

# Create app directory
WORKDIR /app

# Install necessary build tools and dependencies
RUN apk add --no-cache python3 make g++ curl openjdk17 maven

# Install specific pnpm version compatible with lockfile v9.0
RUN npm install -g pnpm@9.15.0

# Verify pnpm installation
RUN pnpm --version

# Copy package files first (better layer caching)
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile --production=false

# Copy application source
COPY . .

# Build the application
RUN pnpm run build

# Create directories for generated plugins and logs with proper permissions
RUN mkdir -p /app/generated /app/logs

# Change ownership to node user for security and ensure proper permissions
RUN chown -R node:node /app && \
    chmod -R 755 /app/generated /app/logs

USER node

# Expose the port the app runs on
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Command to run the application
CMD ["pnpm", "run", "start:prod"]