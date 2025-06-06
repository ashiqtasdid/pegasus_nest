# PowerShell script to monitor deployment status
$VPS_IP = "37.114.41.124"
$maxAttempts = 10
$sleepSeconds = 30

Write-Host "=== Pegasus Nest Deployment Monitor ===" -ForegroundColor Cyan
Write-Host "VPS IP: $VPS_IP" -ForegroundColor White
Write-Host "Max attempts: $maxAttempts" -ForegroundColor White
Write-Host "Check interval: $sleepSeconds seconds" -ForegroundColor White
Write-Host ""

# Function to check if application is responding
function Test-Application {
    try {
        $response = Invoke-WebRequest -Uri "http://$VPS_IP" -TimeoutSec 10 -UseBasicParsing
        return $response.StatusCode -eq 200
    } catch {
        return $false
    }
}

# Function to check health endpoint
function Test-HealthEndpoint {
    try {
        $response = Invoke-WebRequest -Uri "http://$VPS_IP/health" -TimeoutSec 10 -UseBasicParsing
        return $response.StatusCode -eq 200
    } catch {
        return $false
    }
}

# Monitor deployment
$attempt = 1
$success = $false

Write-Host "Starting deployment monitoring..." -ForegroundColor Yellow

while ($attempt -le $maxAttempts -and -not $success) {
    Write-Host "Attempt $attempt/$maxAttempts" -ForegroundColor Cyan
    
    # Check health endpoint first
    Write-Host "  Checking health endpoint..." -NoNewline
    if (Test-HealthEndpoint) {
        Write-Host " ✅ OK" -ForegroundColor Green
        $healthOk = $true
    } else {
        Write-Host " ❌ Failed" -ForegroundColor Red
        $healthOk = $false
    }
    
    # Check main application
    Write-Host "  Checking main application..." -NoNewline
    if (Test-Application) {
        Write-Host " ✅ OK" -ForegroundColor Green
        $appOk = $true
    } else {
        Write-Host " ❌ Failed" -ForegroundColor Red
        $appOk = $false
    }
    
    if ($healthOk -and $appOk) {
        $success = $true
        break
    }
    
    if ($attempt -lt $maxAttempts) {
        Write-Host "  Waiting $sleepSeconds seconds before next check..." -ForegroundColor Yellow
        Start-Sleep -Seconds $sleepSeconds
    }
    
    $attempt++
}

Write-Host ""
Write-Host "=== Deployment Status ===" -ForegroundColor Cyan

if ($success) {
    Write-Host "🚀 Deployment appears successful!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "1. Test the application in your browser: http://$VPS_IP" -ForegroundColor White
    Write-Host "2. Test GitHub OAuth login functionality" -ForegroundColor White
    Write-Host "3. Monitor application logs if needed" -ForegroundColor White
} else {
    Write-Host "⚠️ Deployment may still be in progress or failed" -ForegroundColor Yellow
    Write-Host "Check GitHub Actions logs for more details" -ForegroundColor White
}

Write-Host ""
Write-Host "=== Resources ===" -ForegroundColor Cyan
Write-Host "GitHub Actions: https://github.com/ashiqtasdid/pegasus_nest/actions" -ForegroundColor Blue
Write-Host "Application URL: http://$VPS_IP" -ForegroundColor Blue
