#!/bin/bash

# Deployment Verification Script
# Run this on your VPS to verify the deployment is working correctly

echo "🔍 Verifying Pegasus Nest deployment..."

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check Docker containers
echo "📦 Checking Docker containers..."
if docker-compose -f /opt/pegasus-nest/docker-compose.prod.yml ps | grep -q "Up"; then
    echo -e "${GREEN}✅ Docker containers are running${NC}"
else
    echo -e "${RED}❌ Docker containers are not running${NC}"
    docker-compose -f /opt/pegasus-nest/docker-compose.prod.yml ps
fi

# Check Nginx
echo "🌐 Checking Nginx..."
if systemctl is-active --quiet nginx; then
    echo -e "${GREEN}✅ Nginx is running${NC}"
else
    echo -e "${RED}❌ Nginx is not running${NC}"
    systemctl status nginx
fi

# Check ports
echo "🔌 Checking open ports..."
if netstat -tuln | grep -q ":80 "; then
    echo -e "${GREEN}✅ Port 80 (HTTP) is open${NC}"
else
    echo -e "${RED}❌ Port 80 (HTTP) is not open${NC}"
fi

if netstat -tuln | grep -q ":443 "; then
    echo -e "${GREEN}✅ Port 443 (HTTPS) is open${NC}"
else
    echo -e "${YELLOW}⚠️ Port 443 (HTTPS) is not open (SSL may not be configured)${NC}"
fi

if netstat -tuln | grep -q ":3000 "; then
    echo -e "${GREEN}✅ Port 3000 (API) is open${NC}"
else
    echo -e "${RED}❌ Port 3000 (API) is not open${NC}"
fi

# Check API health
echo "🏥 Checking API health..."
if curl -f -s http://localhost:3000/health > /dev/null; then
    echo -e "${GREEN}✅ API health check passed${NC}"
else
    echo -e "${RED}❌ API health check failed${NC}"
fi

# Check SSL certificates (if they exist)
echo "🔒 Checking SSL certificates..."
if [ -f "/etc/letsencrypt/live/api.*/fullchain.pem" ]; then
    CERT_EXPIRY=$(openssl x509 -enddate -noout -in /etc/letsencrypt/live/api.*/fullchain.pem | cut -d= -f2)
    echo -e "${GREEN}✅ SSL certificate exists, expires: $CERT_EXPIRY${NC}"
else
    echo -e "${YELLOW}⚠️ SSL certificates not found${NC}"
fi

# Check disk space
echo "💾 Checking disk space..."
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -lt 80 ]; then
    echo -e "${GREEN}✅ Disk usage: $DISK_USAGE%${NC}"
else
    echo -e "${YELLOW}⚠️ Disk usage high: $DISK_USAGE%${NC}"
fi

# Check memory usage
echo "🧠 Checking memory usage..."
MEMORY_USAGE=$(free | awk 'NR==2{printf "%.2f%%", $3*100/$2 }')
echo -e "${GREEN}📊 Memory usage: $MEMORY_USAGE${NC}"

# Show recent logs
echo "📋 Recent application logs:"
if [ -f "/var/log/pegasus-nest/app.log" ]; then
    tail -n 5 /var/log/pegasus-nest/app.log
else
    echo "Log file not found, showing Docker logs:"
    docker-compose -f /opt/pegasus-nest/docker-compose.prod.yml logs --tail=5 pegasus-nest
fi

echo ""
echo "🎉 Deployment verification complete!"
echo "📝 Next steps if needed:"
echo "   - Configure DNS to point to this server"
echo "   - Run SSL certificate generation if not done"
echo "   - Upload your UI files to /var/www/pegasus-ui"
