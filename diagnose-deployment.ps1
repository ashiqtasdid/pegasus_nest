# Deployment Diagnosis Script
# This script diagnoses the current deployment issues

Write-Host "🔍 Diagnosing Pegasus Nest Deployment Issues" -ForegroundColor Red
Write-Host "=============================================" -ForegroundColor Red

$VPS_IP = "37.114.41.124"

Write-Host ""
Write-Host "1. Testing Application Endpoints" -ForegroundColor Yellow
Write-Host "--------------------------------" -ForegroundColor Yellow

$endpoints = @(
    @{ url = "http://$VPS_IP/health"; name = "Backend Health" },
    @{ url = "http://$VPS_IP"; name = "Frontend (Main)" },
    @{ url = "http://$VPS_IP/api/auth/get-session"; name = "Auth API" }
)

foreach ($endpoint in $endpoints) {
    try {
        $response = Invoke-WebRequest -Uri $endpoint.url -TimeoutSec 10 -ErrorAction SilentlyContinue
        Write-Host "✅ $($endpoint.name): OK (Status: $($response.StatusCode))" -ForegroundColor Green
        if ($endpoint.name -eq "Backend Health") {
            $content = $response.Content | ConvertFrom-Json
            Write-Host "   Uptime: $([math]::Round($content.uptime)) seconds" -ForegroundColor Gray
        }
    } catch {
        $errorMessage = $_.Exception.Message
        if ($errorMessage -like "*502*") {
            Write-Host "❌ $($endpoint.name): 502 Bad Gateway (Container not running)" -ForegroundColor Red
        } elseif ($errorMessage -like "*Frontend not built*") {
            Write-Host "❌ $($endpoint.name): Frontend build failed" -ForegroundColor Red
        } else {
            Write-Host "❌ $($endpoint.name): $errorMessage" -ForegroundColor Red
        }
    }
}

Write-Host ""
Write-Host "2. Diagnosis Summary" -ForegroundColor Yellow
Write-Host "-------------------" -ForegroundColor Yellow

Write-Host "Based on the test results above:" -ForegroundColor White
Write-Host ""

Write-Host "🔍 Likely Issues:" -ForegroundColor Cyan
Write-Host "• Frontend container failed to build or start (502 Bad Gateway)" -ForegroundColor White
Write-Host "• Frontend build process failed during deployment" -ForegroundColor White
Write-Host "• Docker containers may not be running properly" -ForegroundColor White
Write-Host "• Environment variables may not be properly set" -ForegroundColor White

Write-Host ""
Write-Host "3. Recommended Actions" -ForegroundColor Yellow
Write-Host "---------------------" -ForegroundColor Yellow

Write-Host "1. Check GitHub Actions logs:" -ForegroundColor Cyan
Write-Host "   https://github.com/ashiqtasdid/pegasus_nest/actions" -ForegroundColor Blue

Write-Host ""
Write-Host "2. Common fixes to try:" -ForegroundColor Cyan
Write-Host "   • Fix frontend Docker build issues" -ForegroundColor White
Write-Host "   • Ensure environment files are properly created" -ForegroundColor White
Write-Host "   • Check if all required secrets are set in GitHub" -ForegroundColor White
Write-Host "   • Verify pnpm and Node.js versions in Dockerfiles" -ForegroundColor White

Write-Host ""
Write-Host "3. Manual troubleshooting (if you have SSH access):" -ForegroundColor Cyan
Write-Host "   ssh root@$VPS_IP" -ForegroundColor Blue
Write-Host "   cd /opt/pegasus-nest" -ForegroundColor Blue
Write-Host "   docker-compose -f docker-compose.simple.yml logs" -ForegroundColor Blue
Write-Host "   docker-compose -f docker-compose.simple.yml ps" -ForegroundColor Blue

Write-Host ""
Write-Host "4. GitHub Secrets to verify:" -ForegroundColor Cyan
Write-Host "   • VPS_SSH_KEY" -ForegroundColor White
Write-Host "   • OPENROUTER_API_KEY" -ForegroundColor White
Write-Host "   • MONGODB_URL" -ForegroundColor White
Write-Host "   • OAUTH_GITHUB_CLIENT_ID" -ForegroundColor White
Write-Host "   • OAUTH_GITHUB_CLIENT_SECRET" -ForegroundColor White
Write-Host "   • BETTER_AUTH_SECRET" -ForegroundColor White

Write-Host ""
Write-Host "5. Next Steps:" -ForegroundColor Yellow
Write-Host "-------------" -ForegroundColor Yellow
Write-Host "Review the GitHub Actions workflow logs to see where exactly the deployment failed." -ForegroundColor White
Write-Host "Look for frontend build errors, Docker build failures, or environment variable issues." -ForegroundColor White
