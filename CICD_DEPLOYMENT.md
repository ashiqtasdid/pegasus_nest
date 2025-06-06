# 🚀 GitHub Actions CI/CD Deployment Guide

This repository uses GitHub Actions for automatic deployment to your VPS at `37.114.41.124`.

## Setup Instructions

### 1. GitHub Repository Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions, and add these secrets:

#### Required Secrets:
- **`VPS_SSH_KEY`**: Your private SSH key for VPS access
- **`OPENROUTER_API_KEY`**: Your OpenRouter API key

### 2. Generate SSH Key for GitHub Actions

On your local machine or VPS, generate a new SSH key:

```bash
ssh-keygen -t rsa -b 4096 -C "github-actions" -f ~/.ssh/github_actions_key
```

**Add the public key to your VPS:**
```bash
# Copy the public key
cat ~/.ssh/github_actions_key.pub

# On your VPS, add it to authorized_keys
ssh root@37.114.41.124
echo "YOUR_PUBLIC_KEY_HERE" >> ~/.ssh/authorized_keys
```

**Add the private key to GitHub Secrets:**
```bash
# Copy the private key content
cat ~/.ssh/github_actions_key
# Paste this entire content as VPS_SSH_KEY secret in GitHub
```

### 3. VPS Prerequisites

Make sure your VPS has Docker and Docker Compose installed:

```bash
# On your VPS (37.114.41.124)
apt update && apt upgrade -y
apt install -y docker.io docker-compose
systemctl start docker
systemctl enable docker
```

## How It Works

### Workflow Triggers
- **Push to main/master**: Automatically deploys to production
- **Pull Request**: Runs tests only (no deployment)

### Deployment Process
1. **Test Phase**: 
   - Installs dependencies
   - Builds both backend and frontend
   - Runs tests (if available)

2. **Deploy Phase** (only on main/master):
   - Copies code to VPS
   - Creates environment files
   - Stops old containers
   - Builds and starts new containers
   - Verifies deployment

### Files Excluded from Git
The following files/directories are ignored:
- `node_modules/`
- `.env*` files
- Build artifacts (`dist/`, `.next/`, `build/`)
- Logs and generated files
- Local deployment scripts
- Cache directories

## Manual Deployment

If you need to deploy manually:

```bash
# On your VPS
cd /opt/pegasus-nest
./deploy-vps.sh
```

## Monitoring

Check deployment status:
```bash
# View running containers
docker ps

# Check logs
docker-compose -f docker-compose.simple.yml logs -f

# Test endpoints
curl http://37.114.41.124/health
curl http://37.114.41.124
```

## Troubleshooting

### Deployment Fails
1. Check GitHub Actions logs
2. SSH into VPS and check Docker logs
3. Verify environment variables are set

### Service Not Accessible
1. Check if containers are running: `docker ps`
2. Check nginx configuration: `docker exec pegasus-nginx nginx -t`
3. Verify firewall settings on VPS

### Rollback
If deployment fails, the workflow automatically attempts to restore the previous version.

Manual rollback:
```bash
# On VPS
cd /opt/pegasus-nest-backup
docker-compose -f docker-compose.simple.yml up -d
```

## Security Notes

- SSH keys are used for secure deployment
- Environment variables are stored as GitHub secrets
- No sensitive data is committed to the repository
- Containers run with minimal privileges
