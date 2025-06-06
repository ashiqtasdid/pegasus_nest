# 🚀 Pegasus Nest - AI Plugin Generator

A full-stack application for generating AI plugins using NestJS backend and Next.js frontend, with automated deployment via GitHub Actions.

## 🏗️ Architecture

- **Backend**: NestJS API with TypeScript
- **Frontend**: Next.js with React and Tailwind CSS
- **Database**: MongoDB with Better Auth
- **Deployment**: Docker + GitHub Actions CI/CD
- **Proxy**: Nginx reverse proxy

## 🚀 Quick Start

### Local Development

```bash
# Install dependencies
pnpm install
cd frontend && pnpm install

# Start backend
pnpm run start:dev

# Start frontend (in another terminal)
cd frontend && pnpm run dev
```

### Production Deployment

Push to main branch for automatic deployment via GitHub Actions.

## 📋 Prerequisites

- Node.js 20+
- pnpm
- Docker & Docker Compose (for deployment)
- MongoDB (for auth)

## 🔧 Environment Setup

Copy `.env.template` to `.env` and fill in your values:

```bash
NODE_ENV=production
OPENROUTER_API_KEY=your_api_key_here
```

## 📚 Documentation

- [CI/CD Deployment Guide](./CICD_DEPLOYMENT.md)
- [Docker Deployment Guide](./DOCKER_DEPLOYMENT.md)

## 🔗 Endpoints

- **Frontend**: http://37.114.41.124
- **API**: http://37.114.41.124/api
- **Health Check**: http://37.114.41.124/health

## 🛠️ Development Scripts

```bash
# Backend
pnpm run start:dev      # Start backend in development
pnpm run build          # Build backend
pnpm run test           # Run tests

# Frontend
cd frontend
pnpm run dev            # Start frontend in development
pnpm run build          # Build frontend
pnpm run lint           # Lint code

# Full stack
pnpm run build:all      # Build both backend and frontend
```

## 🚀 Features

- AI Plugin Generation
- User Authentication (Better Auth)
- Real-time Chat Interface
- Plugin Management
- RESTful API
- Responsive UI
- Docker Containerization
- Automated CI/CD

## 📁 Project Structure

```
pegasus_nest/
├── src/                    # Backend source code
├── frontend/               # Next.js frontend
├── .github/workflows/      # GitHub Actions
├── docker-compose.simple.yml
├── nginx-production.conf
├── deploy-vps.sh
└── Dockerfile
```

## 🔒 Security

- Environment variables stored as GitHub secrets
- SSH key authentication for deployment
- Nginx security headers
- Rate limiting on API endpoints

## 📝 License

Private - All rights reserved
