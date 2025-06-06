# Local test script for Docker build issues
Write-Host "🧪 Testing Docker builds locally..." -ForegroundColor Cyan

# Set variables
$env:DOCKER_BUILDKIT = "0"

# Function to log with timestamp
function Write-Log {
    param($Message)
    Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message" -ForegroundColor Green
}

# Test 1: Try building with pnpm
Write-Log "Testing pnpm build..."
$pnpmResult = docker build -t pegasus-nest-test-pnpm -f Dockerfile .
if ($LASTEXITCODE -eq 0) {
    Write-Log "✅ pnpm build successful"
    $pnpmSuccess = $true
} else {
    Write-Log "❌ pnpm build failed"
    $pnpmSuccess = $false
}

# Test 2: Try building with npm
Write-Log "Testing npm build..."
$npmResult = docker build -t pegasus-nest-test-npm -f Dockerfile.npm .
if ($LASTEXITCODE -eq 0) {
    Write-Log "✅ npm build successful"
    $npmSuccess = $true
} else {
    Write-Log "❌ npm build failed"
    $npmSuccess = $false
}

# Summary
Write-Log "=== BUILD TEST SUMMARY ==="
if ($pnpmSuccess) {
    Write-Log "✅ pnpm build: SUCCESS"
} else {
    Write-Log "❌ pnpm build: FAILED"
}

if ($npmSuccess) {
    Write-Log "✅ npm build: SUCCESS"
} else {
    Write-Log "❌ npm build: FAILED"
}

# Clean up test images
Write-Log "Cleaning up test images..."
docker rmi pegasus-nest-test-pnpm 2>$null
docker rmi pegasus-nest-test-npm 2>$null

if ($pnpmSuccess -or $npmSuccess) {
    Write-Log "🎉 At least one build method works! Ready for deployment."
    exit 0
} else {
    Write-Log "💥 Both build methods failed. Check Docker setup."
    exit 1
}
