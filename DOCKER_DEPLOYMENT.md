# Pegasus Nest Docker Deployment Guide

This guide covers deploying the complete Pegasus Nest application (NestJS backend + Next.js frontend) using Docker.

## 🚀 Quick Start

### Local Deployment
```powershell
# Deploy locally with Docker
.\local-deploy.ps1

# Deploy with API key
.\local-deploy.ps1 -OpenRouterApiKey "sk-your-key-here"

# Force rebuild and show logs
.\local-deploy.ps1 -Force -Logs
```

### VPS Deployment
```powershell
# Deploy to VPS (37.114.41.124)
.\vps-deploy.ps1

# Deploy with API key
.\vps-deploy.ps1 -OpenRouterApiKey "sk-your-key-here"

# Deploy to custom VPS
.\vps-deploy.ps1 -VpsIp "your-vps-ip" -SshUser "your-user"

# Force rebuild
.\vps-deploy.ps1 -Force
```

## 📋 Prerequisites

### For Local Deployment
- Docker Desktop installed and running
- PowerShell (Windows) or Bash (Linux/macOS)

### For VPS Deployment
- SSH access to your VPS (key-based authentication recommended)
- VPS running Linux (Ubuntu/Debian/CentOS)
- SSH client installed locally

## 🏗️ Architecture

The deployment includes:

1. **Backend Service** (`pegasus-nest`)
   - NestJS API server
   - Port: 3000 (internal)
   - Health check: `/health`

2. **Frontend Service** (`pegasus-frontend`)
   - Next.js application
   - Port: 3000 (internal)
   - Standalone build for optimal performance

3. **Nginx Reverse Proxy**
   - Routes traffic between frontend and backend
   - Port: 80 (external)
   - Static file serving with caching

## 🔧 Configuration

### Environment Variables

**Backend (.env.production):**
```bash
NODE_ENV=production
OPENROUTER_API_KEY=your_key_here
PORT=3000
SITE_URL=http://37.114.41.124
JWT_SECRET=your_jwt_secret
```

**Frontend (frontend/.env.production):**
```bash
NODE_ENV=production
NEXT_PUBLIC_API_URL=http://37.114.41.124/api
NEXT_PUBLIC_SITE_URL=http://37.114.41.124
NEXTAUTH_URL=http://37.114.41.124
```

### Docker Compose Files

- `docker-compose.yml` - Development/local deployment
- `docker-compose.prod.yml` - Production deployment with resource limits

### Nginx Configuration

- `nginx-production.conf` - Production reverse proxy configuration
- Routes `/api/*` to backend service
- Routes everything else to frontend service
- Caches static assets

## 🛠️ Manual Commands

### Build and Run Locally
```powershell
# Using production compose file
docker compose -f docker-compose.prod.yml up --build -d

# Check status
docker compose -f docker-compose.prod.yml ps

# View logs
docker compose -f docker-compose.prod.yml logs -f

# Stop services
docker compose -f docker-compose.prod.yml down
```

### VPS Manual Deployment
```bash
# On VPS, create app directory
mkdir -p /opt/pegasus-nest
cd /opt/pegasus-nest

# Copy your files here, then:
docker compose -f docker-compose.prod.yml up --build -d
```

## 🔍 Health Checks

The deployment includes built-in health checks:

- **Backend**: `http://localhost/health` or `http://your-vps-ip/health`
- **Frontend**: `http://localhost` or `http://your-vps-ip`
- **API**: `http://localhost/api/health` or `http://your-vps-ip/api/health`

## 📊 Monitoring

### View Container Status
```powershell
docker compose -f docker-compose.prod.yml ps
```

### View Logs
```powershell
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f pegasus-nest
docker compose -f docker-compose.prod.yml logs -f pegasus-frontend
docker compose -f docker-compose.prod.yml logs -f nginx
```

### Resource Usage
```powershell
docker stats
```

## 🔄 Updates and Maintenance

### Update Application
```powershell
# Local
.\local-deploy.ps1 -Force

# VPS
.\vps-deploy.ps1 -Force
```

### Restart Services
```powershell
docker compose -f docker-compose.prod.yml restart
```

### View Container Details
```powershell
docker compose -f docker-compose.prod.yml exec pegasus-nest bash
docker compose -f docker-compose.prod.yml exec pegasus-frontend sh
```

## 🔧 Troubleshooting

### Common Issues

1. **Docker not running**
   ```
   Error: Cannot connect to the Docker daemon
   ```
   Solution: Start Docker Desktop

2. **Port already in use**
   ```
   Error: Port 80 is already allocated
   ```
   Solution: Stop other services or change ports in docker-compose.prod.yml

3. **SSH connection failed (VPS)**
   ```
   Error: SSH connection failed
   ```
   Solution: Ensure SSH key is set up and VPS is accessible

4. **Health check failed**
   ```
   Error: Health check: Failed
   ```
   Solution: Check container logs and ensure services started properly

### Debug Commands

```powershell
# Check container logs
docker compose -f docker-compose.prod.yml logs [service-name]

# Execute into container
docker compose -f docker-compose.prod.yml exec [service-name] bash

# Check network connectivity
docker network ls
docker network inspect pegasus_pegasus-network

# Test endpoints manually
curl http://localhost/health
curl http://localhost/api/health
```

## 🚪 URLs After Deployment

**Local:**
- Application: http://localhost
- API: http://localhost/api
- Health: http://localhost/health

**VPS (37.114.41.124):**
- Application: http://37.114.41.124
- API: http://37.114.41.124/api
- Health: http://37.114.41.124/health

## 📝 Notes

- The frontend is built in standalone mode for optimal Docker performance
- Static assets are cached by Nginx for better performance
- All services include health checks for reliable deployment
- Resource limits are set to prevent overconsumption
- Logs are persisted in Docker volumes
- The chat system shows "under construction" messaging as configured
