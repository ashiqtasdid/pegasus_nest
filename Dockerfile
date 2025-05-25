FROM node:18-alpine

# Create app directory
WORKDIR /app

# Install necessary build tools for any native dependencies
RUN apk add --no-cache python3 make g++ curl

# Install Java for Maven builds
RUN apk add --no-cache openjdk17

# Install Maven
RUN apk add --no-cache maven

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json ./

# Install dependencies
RUN pnpm install

# Copy application source
COPY . .

# Build the application
RUN pnpm run build

# Expose the port the app runs on
EXPOSE 3000

# Command to run the application
CMD ["pnpm", "run", "start:prod"]