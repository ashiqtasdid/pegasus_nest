# Deployment Monitoring Script
# Run this to check the status of the deployment

Write-Host "🔍 Monitoring Pegasus Nest Deployment" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan

$VPS_IP = "37.114.41.124"
$maxAttempts = 30
$attempt = 0

Write-Host ""
Write-Host "1. Checking VPS connectivity..." -ForegroundColor Yellow

# Test basic connectivity
try {
    $ping = Test-NetConnection -ComputerName $VPS_IP -Port 80 -InformationLevel Quiet
    if ($ping) {
        Write-Host "✅ VPS is reachable on port 80" -ForegroundColor Green
    } else {
        Write-Host "❌ VPS is not reachable on port 80" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Error testing VPS connectivity: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "2. Waiting for deployment to complete..." -ForegroundColor Yellow

do {
    $attempt++
    Write-Host "Attempt $attempt/$maxAttempts - Checking application status..." -ForegroundColor Gray
    
    try {
        # Check health endpoint
        $healthResponse = Invoke-WebRequest -Uri "http://$VPS_IP/health" -TimeoutSec 10 -ErrorAction SilentlyContinue
        if ($healthResponse.StatusCode -eq 200) {
            Write-Host "✅ Health endpoint responding" -ForegroundColor Green
            break
        }
    } catch {
        # Try main endpoint if health fails
        try {
            $mainResponse = Invoke-WebRequest -Uri "http://$VPS_IP" -TimeoutSec 10 -ErrorAction SilentlyContinue
            if ($mainResponse.StatusCode -eq 200) {
                Write-Host "✅ Main application responding" -ForegroundColor Green
                break
            }
        } catch {
            Write-Host "⏳ Application not ready yet..." -ForegroundColor Gray
        }
    }
    
    if ($attempt -lt $maxAttempts) {
        Start-Sleep 30
    }
    
} while ($attempt -lt $maxAttempts)

Write-Host ""
Write-Host "3. Final application status check..." -ForegroundColor Yellow

$endpoints = @(
    @{ url = "http://$VPS_IP"; name = "Main Application" },
    @{ url = "http://$VPS_IP/health"; name = "Health Check" },
    @{ url = "http://$VPS_IP/api/auth/get-session"; name = "Auth Session API" }
)

foreach ($endpoint in $endpoints) {
    try {
        $response = Invoke-WebRequest -Uri $endpoint.url -TimeoutSec 10 -ErrorAction SilentlyContinue
        if ($response.StatusCode -eq 200) {
            Write-Host "✅ $($endpoint.name): OK (Status: $($response.StatusCode))" -ForegroundColor Green
        } else {
            Write-Host "⚠️  $($endpoint.name): Status $($response.StatusCode)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "❌ $($endpoint.name): Failed - $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "4. GitHub OAuth Authentication Test" -ForegroundColor Yellow
Write-Host "Open this URL to test GitHub login:" -ForegroundColor Cyan
Write-Host "http://$VPS_IP/api/auth/sign-in/github" -ForegroundColor Blue

Write-Host ""
Write-Host "5. Deployment Resources" -ForegroundColor Yellow
Write-Host "GitHub Actions: https://github.com/ashiqtasdid/pegasus_nest/actions" -ForegroundColor Blue
Write-Host "Application URL: http://$VPS_IP" -ForegroundColor Blue

Write-Host ""
if ($attempt -lt $maxAttempts) {
    Write-Host "🚀 Deployment appears successful!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "1. Test the application in your browser: http://$VPS_IP" -ForegroundColor White
    Write-Host "2. Test GitHub OAuth login functionality" -ForegroundColor White
    Write-Host "3. Monitor application logs if needed" -ForegroundColor White
} else {
    Write-Host "⚠️  Deployment may still be in progress or failed" -ForegroundColor Yellow
    Write-Host "Check GitHub Actions logs for more details" -ForegroundColor White
}
