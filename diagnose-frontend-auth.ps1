# PowerShell script to diagnose frontend auth issues

# Script header
Write-Host "🔍 Frontend Authentication Diagnostic" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan

# Define paths
$envFile = "frontend/.env.local"
$authConfigFile = "frontend/lib/auth.ts"
$authClientFile = "frontend/src/lib/auth-client.ts"
$authRoutesFile = "frontend/app/api/auth/[...all]/route.ts"

# Check if files exist
Write-Host "`nChecking required files..." -ForegroundColor Yellow
$missingFiles = @()

if (-not (Test-Path $envFile)) {
    $missingFiles += $envFile
}
if (-not (Test-Path $authConfigFile)) {
    $missingFiles += $authConfigFile
}
if (-not (Test-Path $authRoutesFile)) {
    $missingFiles += $authRoutesFile
}

if ($missingFiles.Count -gt 0) {
    Write-Host "❌ Missing files:" -ForegroundColor Red
    foreach ($file in $missingFiles) {
        Write-Host "   - $file" -ForegroundColor Red
    }
} else {
    Write-Host "✅ All required files found" -ForegroundColor Green
}

# Check environment variables
Write-Host "`nChecking environment variables in $envFile..." -ForegroundColor Yellow
if (Test-Path $envFile) {
    $envContent = Get-Content $envFile
    
    # Check for required variables
    $requiredVars = @(
        "MONGODB_URL",
        "GITHUB_CLIENT_ID",
        "GITHUB_CLIENT_SECRET",
        "BETTER_AUTH_SECRET",
        "BETTER_AUTH_URL"
    )
    
    $missingVars = @()
    $placeholderVars = @()
    
    foreach ($var in $requiredVars) {
        $varLine = $envContent | Where-Object { $_ -match "^$var=" }
        if (-not $varLine) {
            $missingVars += $var
        } else {
            $value = $varLine.Split('=', 2)[1]
            if ($value -eq "placeholder" -or $value -eq "") {
                $placeholderVars += $var
            }
        }
    }
    
    if ($missingVars.Count -gt 0) {
        Write-Host "❌ Missing environment variables:" -ForegroundColor Red
        foreach ($var in $missingVars) {
            Write-Host "   - $var" -ForegroundColor Red
        }
    }
    
    if ($placeholderVars.Count -gt 0) {
        Write-Host "⚠️ Environment variables with placeholder values:" -ForegroundColor Yellow
        foreach ($var in $placeholderVars) {
            Write-Host "   - $var" -ForegroundColor Yellow
        }
    }
    
    if ($missingVars.Count -eq 0 -and $placeholderVars.Count -eq 0) {
        Write-Host "✅ All environment variables are properly set" -ForegroundColor Green
    }
} else {
    Write-Host "❌ Environment file not found: $envFile" -ForegroundColor Red
}

# Check auth configuration
Write-Host "`nChecking auth configuration in $authConfigFile..." -ForegroundColor Yellow
if (Test-Path $authConfigFile) {
    $authConfig = Get-Content $authConfigFile -Raw
    
    # Check for GitHub provider
    if ($authConfig -match "github\(\{") {
        Write-Host "✅ GitHub provider is configured" -ForegroundColor Green
    } else {
        Write-Host "❌ GitHub provider is not configured correctly" -ForegroundColor Red
    }
    
    # Check for MongoDB adapter
    if ($authConfig -match "mongodbAdapter\(") {
        Write-Host "✅ MongoDB adapter is configured" -ForegroundColor Green
    } else {
        Write-Host "❌ MongoDB adapter is not configured correctly" -ForegroundColor Red
    }
    
    # Check for Next.js cookies plugin
    if ($authConfig -match "nextCookies\(\)") {
        Write-Host "✅ Next.js cookies plugin is configured" -ForegroundColor Green
    } else {
        Write-Host "❌ Next.js cookies plugin is not configured" -ForegroundColor Red
    }
} else {
    Write-Host "❌ Auth configuration file not found: $authConfigFile" -ForegroundColor Red
}

# Check route handler
Write-Host "`nChecking auth route handler in $authRoutesFile..." -ForegroundColor Yellow
if (Test-Path $authRoutesFile) {
    $routeContent = Get-Content $authRoutesFile -Raw
    
    if ($routeContent -match "toNextJsHandler\(auth\)") {
        Write-Host "✅ Next.js auth handler is correctly configured" -ForegroundColor Green
    } else {
        Write-Host "❌ Next.js auth handler is not configured correctly" -ForegroundColor Red
    }
} else {
    Write-Host "❌ Auth route handler file not found: $authRoutesFile" -ForegroundColor Red
}

# Summary
Write-Host "`n📊 Authentication Diagnostic Summary" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan

# Provide fix recommendations
Write-Host "`nRecommendations:" -ForegroundColor Yellow
Write-Host "1. Ensure all environment variables are properly set in $envFile" -ForegroundColor White
Write-Host "2. Verify GitHub OAuth credentials are valid and not placeholders" -ForegroundColor White
Write-Host "3. Check that MongoDB connection string is correct" -ForegroundColor White
Write-Host "4. Make sure the auth routes are properly registered" -ForegroundColor White
Write-Host "5. Run 'npm run build' or 'pnpm run build' to rebuild the frontend" -ForegroundColor White

Write-Host "`n✨ Diagnostic complete" -ForegroundColor Green
