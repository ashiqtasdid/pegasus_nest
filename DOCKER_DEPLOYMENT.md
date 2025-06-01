# 🐳 Docker Deployment Guide - Pegasus Nest API

## ✅ Pre-Deployment Checklist

Your codebase is **ready for Docker deployment on Linux** with the following configurations:

### Fixed Issues:

- ✅ **Port standardization**: Unified to port 3000
- ✅ **Package manager**: Added pnpm-lock.yaml to Dockerfile
- ✅ **Environment files**: Created production configurations
- ✅ **Cross-platform paths**: Application handles Linux paths correctly
- ✅ **Health checks**: Implemented for container monitoring

## 🚀 Deployment Options

### Option 1: Simple Development Deployment

```bash
# Linux/macOS
./deploy.sh

# Windows PowerShell
./deploy.ps1
```

### Option 2: Production Deployment

```bash
# Linux/macOS
docker-compose -f docker-compose.prod.yml --env-file .env.production up -d

# Windows PowerShell
./deploy.ps1 -Production
```

### Option 3: Advanced Docker Deployment (Windows)

```powershell
# Development
./deploy-docker.ps1 -Environment dev

# Production with monitoring
./deploy-docker.ps1 -Environment prod -Monitor

# Clean rebuild
./deploy-docker.ps1 -Environment prod -Clean
```

## 📋 Environment Setup

### 1. Production Environment (.env.production)

```bash
NODE_ENV=production
OPENROUTER_API_KEY=your_actual_api_key_here
PORT=3000
SITE_URL=https://your-domain.com
SITE_NAME=Pegasus API
AI_FIXING_ENABLED=true
AUTO_FIX_ENABLED=true
DEBUG_AI_PROMPTS=false
```

### 2. Development Environment (.env)

```bash
NODE_ENV=development
OPENROUTER_API_KEY=your_api_key_here
PORT=3000
SITE_URL=http://localhost:3000
SITE_NAME=Pegasus API Dev
AI_FIXING_ENABLED=true
AUTO_FIX_ENABLED=true
DEBUG_AI_PROMPTS=true
```

## 🐳 Docker Configurations

### Development Stack (docker-compose.yml)

- **Application**: Port 3000
- **Direct access**: No reverse proxy
- **Volumes**: Local development folders
- **Environment**: Development settings

### Production Stack (docker-compose.prod.yml)

- **Application**: Port 3000 (internal)
- **Nginx**: Port 80/443 (external)
- **Health checks**: Enabled
- **Resource limits**: Configured
- **Restart policy**: unless-stopped

## 🔧 Container Features

### Application Container

- **Base**: `node:18-alpine`
- **Dependencies**: Java 17, Maven, Python (for native modules)
- **Package Manager**: pnpm
- **Build**: TypeScript compilation
- **Health Check**: `/health` endpoint

### Nginx Container (Production)

- **Base**: `nginx:alpine`
- **Proxy**: Reverse proxy to application
- **SSL Ready**: Certificate volume mount
- **Health Check**: Dependency on app container

## 📊 Monitoring & Management

### Health Checks

```bash
# Application health
curl http://localhost:3000/health

# Detailed health
curl http://localhost:3000/health/detailed

# Optimization stats
curl http://localhost:3000/api/optimization-stats
```

### Container Management

```bash
# View logs
docker-compose logs -f

# Scale services
docker-compose up -d --scale pegasus-nest=2

# Update containers
docker-compose pull && docker-compose up -d

# Backup volumes
docker run --rm -v pegasus_generated:/data -v $(pwd):/backup alpine tar czf /backup/generated-backup.tar.gz -C /data .
```

## 🔐 Security Considerations

### 1. Environment Variables

- Never commit `.env.production` with real API keys
- Use Docker secrets for sensitive data in production
- Rotate API keys regularly

### 2. Network Security

```yaml
# Add to docker-compose.prod.yml for external networks
networks:
  pegasus-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
```

### 3. SSL/TLS Setup

```bash
# Create SSL directory
mkdir ssl

# Add your certificates
cp your-cert.crt ssl/
cp your-private.key ssl/

# Update nginx.conf for HTTPS
```

## 🚨 Troubleshooting

### Common Issues

1. **Port Already in Use**

   ```bash
   # Find process using port
   lsof -i :3000
   # Kill process or change port
   ```

2. **Permission Issues**

   ```bash
   # Fix volume permissions
   sudo chown -R $USER:$USER ./generated
   ```

3. **Out of Memory**

   ```bash
   # Increase Docker memory limit
   # Update docker-compose.prod.yml resources
   ```

4. **API Key Issues**
   ```bash
   # Check environment variables
   docker exec pegasus-nest env | grep OPENROUTER
   ```

### Debug Commands

```bash
# Container shell access
docker exec -it pegasus-nest sh

# View application logs
docker logs -f pegasus-nest

# Check container stats
docker stats pegasus-nest

# Inspect container
docker inspect pegasus-nest
```

## 📈 Performance Optimization

### Production Optimizations

- **Resource limits**: Prevent memory leaks
- **Health checks**: Auto-restart on failure
- **Connection pooling**: Optimized HTTP agent
- **Caching**: Response caching enabled
- **Compression**: Nginx gzip compression

### Scaling Considerations

```yaml
# For high-load scenarios
deploy:
  replicas: 3
  resources:
    limits:
      memory: 4G
      cpus: '2.0'
```

## 🎯 Next Steps

1. **Set up your environment**:

   - Copy `.env.production` and add your API keys
   - Configure domain settings

2. **Deploy**:

   - Run deployment script for your platform
   - Verify health checks pass

3. **Monitor**:

   - Set up log monitoring
   - Configure alerts for health check failures

4. **Scale** (if needed):
   - Add load balancer
   - Configure container orchestration
   - Set up monitoring dashboard

## 📞 Support

- **Health Check**: `GET /health`
- **API Documentation**: `GET /ui`
- **Logs**: `docker logs pegasus-nest`
- **Stats**: `GET /api/optimization-stats`

Your Pegasus Nest API is now **production-ready** for Docker deployment on Linux! 🚀
