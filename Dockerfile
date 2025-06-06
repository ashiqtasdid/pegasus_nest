# Backend Dockerfile
FROM node:20-alpine

# Create app directory
WORKDIR /app

# Install necessary build tools and dependencies
RUN apk add --no-cache python3 make g++ curl openjdk17 maven

# Install pnpm
RUN npm install -g pnpm@8.15.8

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy application source
COPY . .

# Build the application
RUN pnpm run build

# Create directories for generated plugins
RUN mkdir -p /app/generated
RUN mkdir -p /app/logs

# Expose the port the app runs on
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Command to run the application
CMD ["pnpm", "run", "start:prod"]