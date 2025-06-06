# VPS Setup Guide for Automated GitHub Actions Deployment

This guide will walk you through setting up your VPS (37.114.41.124) to work perfectly with your GitHub Actions CI/CD pipeline.

## Prerequisites
- VPS with IP: 37.114.41.124
- Root access to the VPS
- SSH client on your local machine

## Step-by-Step VPS Setup

### Step 1: Connect to Your VPS
```bash
ssh root@37.114.41.124
```

### Step 2: Update System Packages
```bash
# Update package lists
apt update && apt upgrade -y

# Install essential tools
apt install -y curl wget git unzip software-properties-common apt-transport-https ca-certificates gnupg lsb-release
```

### Step 3: Install Docker
```bash
# Add Docker's official GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Add Docker repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# Update package lists again
apt update

# Install Docker Engine
apt install -y docker-ce docker-ce-cli containerd.io

# Start and enable Docker
systemctl start docker
systemctl enable docker

# Verify Docker installation
docker --version
docker run hello-world
```

### Step 4: Install Docker Compose
```bash
# Download Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

# Make it executable
chmod +x /usr/local/bin/docker-compose

# Create symlink for easier access
ln -s /usr/local/bin/docker-compose /usr/bin/docker-compose

# Verify installation
docker-compose --version
```

### Step 5: Install rsync (for file copying from GitHub Actions)
```bash
apt install -y rsync
```

### Step 6: Set Up SSH Key for GitHub Actions

#### Option A: Generate new SSH key on your local machine
```bash
# On your local machine (not VPS), generate SSH key pair
ssh-keygen -t rsa -b 4096 -C "github-actions@pegasus-nest" -f ~/.ssh/pegasus_nest_deploy

# This creates two files:
# ~/.ssh/pegasus_nest_deploy (private key - for GitHub secrets)
# ~/.ssh/pegasus_nest_deploy.pub (public key - for VPS)
```

#### Option B: Use existing SSH key
If you already have an SSH key you want to use, locate the public key file (usually `~/.ssh/id_rsa.pub`).

### Step 7: Add Public Key to VPS
```bash
# On the VPS, create .ssh directory if it doesn't exist
mkdir -p /root/.ssh
chmod 700 /root/.ssh

# Add your public key to authorized_keys
# Replace the content below with your actual public key content
cat >> /root/.ssh/authorized_keys << 'EOF'
ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQ... (your public key content here)
EOF

# Set proper permissions
chmod 600 /root/.ssh/authorized_keys
```

### Step 8: Configure SSH Security (Optional but Recommended)
```bash
# Edit SSH configuration
nano /etc/ssh/sshd_config

# Add or modify these lines:
# PermitRootLogin yes
# PasswordAuthentication no
# PubkeyAuthentication yes

# Restart SSH service
systemctl restart sshd
```

### Step 9: Create Application Directory Structure
```bash
# Create application directories
mkdir -p /opt/pegasus-nest
mkdir -p /opt/pegasus-nest/logs
mkdir -p /opt/pegasus-nest/generated

# Set proper permissions
chmod 755 /opt/pegasus-nest
```

### Step 10: Install Node.js (for any server-side operations if needed)
```bash
# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Verify installation
node --version
npm --version
```

### Step 11: Configure Firewall
```bash
# Install ufw if not installed
apt install -y ufw

# Allow SSH (important - don't lock yourself out!)
ufw allow 22/tcp

# Allow HTTP and HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Allow your application port (if needed for direct access)
ufw allow 3000/tcp

# Enable firewall
ufw --force enable

# Check status
ufw status
```

### Step 12: Test Docker Setup
```bash
# Create a simple test to ensure everything works
docker run --rm -d --name test-nginx -p 8080:80 nginx:alpine

# Check if it's running
curl http://localhost:8080

# Clean up test
docker stop test-nginx
```

## GitHub Repository Setup

### Step 13: Add Secrets to GitHub Repository

1. Go to your GitHub repository: `https://github.com/yourusername/pegasus_nest`
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** and add these secrets:

#### VPS_SSH_KEY
- **Name**: `VPS_SSH_KEY`
- **Value**: Content of your private key file (e.g., content of `~/.ssh/pegasus_nest_deploy`)
- **Note**: Copy the entire content including `-----BEGIN OPENSSH PRIVATE KEY-----` and `-----END OPENSSH PRIVATE KEY-----`

#### OPENROUTER_API_KEY
- **Name**: `OPENROUTER_API_KEY`
- **Value**: Your actual OpenRouter API key

### Step 14: Test SSH Connection from Local Machine
```bash
# Test SSH connection using the private key
ssh -i ~/.ssh/pegasus_nest_deploy root@37.114.41.124

# If successful, you should be able to connect without password
```

## Verification Steps

### Step 15: Verify All Prerequisites
Run this verification script on your VPS:

```bash
#!/bin/bash
echo "=== VPS Setup Verification ==="
echo

echo "1. Docker version:"
docker --version || echo "❌ Docker not installed"
echo

echo "2. Docker Compose version:"
docker-compose --version || echo "❌ Docker Compose not installed"
echo

echo "3. Docker service status:"
systemctl is-active docker || echo "❌ Docker not running"
echo

echo "4. SSH authorized_keys:"
ls -la /root/.ssh/authorized_keys || echo "❌ SSH key not configured"
echo

echo "5. Application directory:"
ls -la /opt/ | grep pegasus-nest || echo "❌ App directory not created"
echo

echo "6. Firewall status:"
ufw status || echo "❌ UFW not configured"
echo

echo "7. Available ports:"
netstat -tlnp | grep -E ':(22|80|443|3000)' || echo "ℹ️ Standard ports available"
echo

echo "8. Disk space:"
df -h /
echo

echo "9. Memory:"
free -h
echo

echo "=== Verification Complete ==="
```

### Step 16: Test GitHub Actions Deployment

1. **Commit and push** any changes to your main branch:
   ```bash
   git add .
   git commit -m "Initial deployment setup"
   git push origin main
   ```

2. **Monitor the deployment**:
   - Go to your GitHub repository
   - Click on **Actions** tab
   - Watch the workflow execution

3. **Check deployment on VPS**:
   ```bash
   # On VPS, check if containers are running
   docker ps
   
   # Check application logs
   docker-compose -f /opt/pegasus-nest/docker-compose.simple.yml logs
   
   # Test the application
   curl http://37.114.41.124
   curl http://37.114.41.124/health
   ```

## Troubleshooting Common Issues

### Issue 1: SSH Connection Fails
```bash
# Check SSH service status
systemctl status sshd

# Check SSH logs
tail -f /var/log/auth.log
```

### Issue 2: Docker Permission Issues
```bash
# Add user to docker group (if using non-root user)
usermod -aG docker $USER

# Restart Docker service
systemctl restart docker
```

### Issue 3: Port Already in Use
```bash
# Check what's using the port
netstat -tlnp | grep :80
lsof -i :80

# Kill the process if needed
kill -9 <PID>
```

### Issue 4: Firewall Blocking Connections
```bash
# Check firewall rules
ufw status verbose

# Allow specific port
ufw allow 80/tcp
```

## Post-Deployment Monitoring

### Set Up Log Monitoring
```bash
# Create log monitoring script
cat > /opt/monitor-app.sh << 'EOF'
#!/bin/bash
echo "=== Application Status Check ==="
echo "Date: $(date)"
echo

echo "Docker containers:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo

echo "Application logs (last 10 lines):"
docker-compose -f /opt/pegasus-nest/docker-compose.simple.yml logs --tail=10
echo

echo "System resources:"
echo "Memory usage:"
free -h
echo "Disk usage:"
df -h /
echo
EOF

chmod +x /opt/monitor-app.sh

# Add to crontab for regular monitoring
echo "*/5 * * * * /opt/monitor-app.sh >> /opt/app-monitor.log 2>&1" | crontab -
```

## Security Recommendations

1. **Change SSH port** (optional):
   ```bash
   nano /etc/ssh/sshd_config
   # Change Port 22 to Port 2222
   systemctl restart sshd
   # Update firewall: ufw allow 2222/tcp && ufw delete allow 22/tcp
   ```

2. **Set up fail2ban**:
   ```bash
   apt install -y fail2ban
   systemctl enable fail2ban
   ```

3. **Regular updates**:
   ```bash
   # Add to crontab for weekly updates
   echo "0 2 * * 0 apt update && apt upgrade -y" | crontab -
   ```

## Next Steps

After completing this setup:

1. ✅ Your VPS will be ready for automated deployments
2. ✅ GitHub Actions will automatically deploy on every push to main branch
3. ✅ Your application will be accessible at `http://37.114.41.124`
4. ✅ Docker containers will handle your backend and frontend services

The deployment process is now fully automated! Every time you push code to the main branch, GitHub Actions will:
- Test your code
- Build Docker images
- Deploy to your VPS
- Verify the deployment

Happy deploying! 🚀
