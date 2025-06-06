# Frontend Dockerfile
FROM node:20-alpine AS deps
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@8.15.8

# Copy package files
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@8.15.8

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Create .env.local if it doesn't exist to prevent build errors
RUN if [ ! -f .env.local ]; then \
    echo "NODE_ENV=production" > .env.local && \
    echo "NEXT_PUBLIC_API_URL=http://localhost:3000" >> .env.local && \
    echo "MONGODB_URL=placeholder" >> .env.local && \
    echo "GITHUB_CLIENT_ID=placeholder" >> .env.local && \
    echo "GITHUB_CLIENT_SECRET=placeholder" >> .env.local && \
    echo "BETTER_AUTH_SECRET=placeholder" >> .env.local && \
    echo "BETTER_AUTH_URL=http://localhost:3000" >> .env.local; \
    fi

# Build the application
RUN pnpm run build

# Production stage
FROM node:20-alpine AS runner
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@8.15.8

# Add non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Set ownership
RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
