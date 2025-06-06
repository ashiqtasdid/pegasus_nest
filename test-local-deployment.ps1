# Test Local Deployment Script
# This script helps test the deployment configuration locally

Write-Host "🚀 Testing Local Deployment Configuration" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Check if we're in the correct directory
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Error: Please run this script from the project root directory" -ForegroundColor Red
    exit 1
}

# Test 1: Check environment files
Write-Host "1. Checking environment configuration..." -ForegroundColor Yellow

if (Test-Path "frontend\.env.local") {
    Write-Host "✅ Frontend .env.local found" -ForegroundColor Green
    
    # Check for required variables
    $envContent = Get-Content "frontend\.env.local" -Raw
    $requiredVars = @("GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET", "BETTER_AUTH_SECRET", "MONGODB_URL")
    
    foreach ($var in $requiredVars) {
        if ($envContent -match "$var=") {
            Write-Host "  ✅ $var is set" -ForegroundColor Green
        } else {
            Write-Host "  ❌ $var is missing" -ForegroundColor Red
        }
    }
} else {
    Write-Host "❌ Frontend .env.local not found" -ForegroundColor Red
    Write-Host "   Create frontend\.env.local with your environment variables" -ForegroundColor Yellow
}

# Test 2: Check if pnpm is available
Write-Host "`n2. Checking pnpm installation..." -ForegroundColor Yellow
try {
    $pnpmVersion = pnpm --version
    Write-Host "✅ pnpm version $pnpmVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ pnpm not found. Please install pnpm: npm install -g pnpm" -ForegroundColor Red
    exit 1
}

# Test 3: Install dependencies
Write-Host "`n3. Installing dependencies..." -ForegroundColor Yellow
try {
    pnpm install
    Write-Host "✅ Dependencies installed successfully" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    exit 1
}

# Test 4: Test build process
Write-Host "`n4. Testing build process..." -ForegroundColor Yellow
try {
    Write-Host "   Building all components..." -ForegroundColor Cyan
    pnpm run build:all
    Write-Host "✅ Build completed successfully" -ForegroundColor Green
} catch {
    Write-Host "❌ Build failed" -ForegroundColor Red
    Write-Host "   Check the error messages above for details" -ForegroundColor Yellow
    exit 1
}

# Test 5: Check OAuth configuration
Write-Host "`n5. Checking OAuth configuration..." -ForegroundColor Yellow
if (Test-Path "frontend\scripts\check-github-oauth-env.js") {
    try {
        Push-Location "frontend"
        node scripts/check-github-oauth-env.js
        Pop-Location
        Write-Host "✅ OAuth configuration check completed" -ForegroundColor Green
    } catch {
        Pop-Location
        Write-Host "❌ OAuth configuration check failed" -ForegroundColor Red
    }
} else {
    Write-Host "⚠️ OAuth check script not found" -ForegroundColor Yellow
}

# Test 6: Check Docker setup
Write-Host "`n6. Checking Docker configuration..." -ForegroundColor Yellow
try {
    docker --version | Out-Null
    Write-Host "✅ Docker is available" -ForegroundColor Green
    
    if (Test-Path "docker-compose.simple.yml") {
        Write-Host "✅ Docker Compose configuration found" -ForegroundColor Green
    } else {
        Write-Host "❌ Docker Compose configuration missing" -ForegroundColor Red
    }
} catch {
    Write-Host "⚠️ Docker not available (required for production deployment)" -ForegroundColor Yellow
}

Write-Host "`n🎉 Local deployment test completed!" -ForegroundColor Green
Write-Host "You can now deploy to GitHub by pushing to main/master branch" -ForegroundColor Cyan
Write-Host ""
Write-Host "📝 Next steps:" -ForegroundColor Yellow
Write-Host "1. Ensure all GitHub secrets are configured (see GITHUB_SECRETS_REFERENCE.md)" -ForegroundColor White
Write-Host "2. Push changes to main/master branch to trigger deployment" -ForegroundColor White
Write-Host "3. Monitor GitHub Actions for deployment status" -ForegroundColor White
