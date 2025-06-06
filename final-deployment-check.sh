#!/bin/bash

# Final Deployment Check Script
# This script validates all deployment configurations before pushing to GitHub

set -e

echo "🔍 Final Deployment Configuration Check"
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

success_count=0
error_count=0

check_file() {
    local file=$1
    local description=$2
    
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅ $description${NC}: $file"
        ((success_count++))
    else
        echo -e "${RED}❌ $description${NC}: $file (MISSING)"
        ((error_count++))
    fi
}

check_docker_file() {
    local file=$1
    local description=$2
    
    if [ -f "$file" ]; then
        if grep -q "node:20-alpine" "$file" && grep -q "pnpm@8.15.8" "$file"; then
            echo -e "${GREEN}✅ $description${NC}: Updated to Node.js 20 and pnpm@8.15.8"
            ((success_count++))
        else
            echo -e "${YELLOW}⚠️  $description${NC}: May need Node.js 20 and pnpm@8.15.8 updates"
        fi
    else
        echo -e "${RED}❌ $description${NC}: $file (MISSING)"
        ((error_count++))
    fi
}

echo ""
echo "1. Core Configuration Files"
echo "----------------------------"
check_file ".github/workflows/deploy.yml" "GitHub Actions Workflow"
check_file "docker-compose.simple.yml" "Docker Compose"
check_file "deploy-vps.sh" "VPS Deployment Script"
check_file "nginx-production.conf" "Nginx Configuration"

echo ""
echo "2. Docker Configuration"
echo "----------------------"
check_docker_file "Dockerfile" "Backend Dockerfile"
check_docker_file "frontend/Dockerfile" "Frontend Dockerfile"

echo ""
echo "3. Application Configuration"
echo "----------------------------"
check_file "frontend/next.config.ts" "Next.js Configuration"
check_file "frontend/lib/auth.ts" "Better Auth Configuration"
check_file "package.json" "Root Package.json"
check_file "frontend/package.json" "Frontend Package.json"

echo ""
echo "4. New Scripts and Documentation"
echo "-------------------------------"
check_file "pre-deployment-test.sh" "Pre-deployment Test Script"
check_file "verify-deployment.sh" "Post-deployment Verification Script"
check_file "DEPLOYMENT_FIX_SUMMARY_FINAL.md" "Fix Documentation"

echo ""
echo "5. Validating GitHub Actions Workflow"
echo "------------------------------------"
if grep -q "node-version: '20'" .github/workflows/deploy.yml; then
    echo -e "${GREEN}✅ Workflow uses Node.js 20${NC}"
    ((success_count++))
else
    echo -e "${RED}❌ Workflow should use Node.js 20${NC}"
    ((error_count++))
fi

if grep -q "bash -s" .github/workflows/deploy.yml; then
    echo -e "${GREEN}✅ Workflow uses proper SSH heredoc syntax${NC}"
    ((success_count++))
else
    echo -e "${RED}❌ Workflow SSH syntax may be incorrect${NC}"
    ((error_count++))
fi

if grep -q "secrets.OAUTH_GITHUB_CLIENT_ID" .github/workflows/deploy.yml; then
    echo -e "${GREEN}✅ Workflow includes GitHub OAuth secrets${NC}"
    ((success_count++))
else
    echo -e "${RED}❌ Workflow missing GitHub OAuth secrets${NC}"
    ((error_count++))
fi

echo ""
echo "6. Deployment Script Validation"
echo "------------------------------"
if [ -f "deploy-vps.sh" ]; then
    if grep -q "set -e" deploy-vps.sh; then
        echo -e "${GREEN}✅ Deployment script has error handling${NC}"
        ((success_count++))
    else
        echo -e "${RED}❌ Deployment script missing error handling${NC}"
        ((error_count++))
    fi
    
    if grep -q "health_check" deploy-vps.sh; then
        echo -e "${GREEN}✅ Deployment script has health checks${NC}"
        ((success_count++))
    else
        echo -e "${RED}❌ Deployment script missing health checks${NC}"
        ((error_count++))
    fi
fi

echo ""
echo "7. Required Secrets Check (GitHub Repository Settings)"
echo "-----------------------------------------------------"
echo -e "${YELLOW}⚠️  Ensure these secrets are configured in GitHub:${NC}"
echo "   - VPS_SSH_KEY"
echo "   - OPENROUTER_API_KEY"
echo "   - MONGODB_URL"
echo "   - OAUTH_GITHUB_CLIENT_ID"
echo "   - OAUTH_GITHUB_CLIENT_SECRET"
echo "   - BETTER_AUTH_SECRET"

echo ""
echo "8. Git Status"
echo "------------"
if command -v git &> /dev/null; then
    if git status --porcelain | grep -q .; then
        echo -e "${YELLOW}⚠️  Uncommitted changes detected:${NC}"
        git status --short
    else
        echo -e "${GREEN}✅ All changes committed${NC}"
        ((success_count++))
    fi
else
    echo -e "${YELLOW}⚠️  Git not available${NC}"
fi

echo ""
echo "=========================================="
echo "Summary"
echo "=========================================="
echo -e "Successful checks: ${GREEN}$success_count${NC}"
if [ $error_count -gt 0 ]; then
    echo -e "Failed checks: ${RED}$error_count${NC}"
    echo ""
    echo -e "${RED}❌ Please fix the issues above before deploying${NC}"
    exit 1
else
    echo -e "Failed checks: ${GREEN}0${NC}"
    echo ""
    echo -e "${GREEN}🚀 Ready for deployment!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Commit and push changes to trigger deployment"
    echo "2. Monitor GitHub Actions logs"
    echo "3. Verify application is running on VPS"
    echo "4. Test GitHub OAuth authentication"
fi
