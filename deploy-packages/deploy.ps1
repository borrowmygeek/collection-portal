# Collection Portal Deployment Script
# This script helps prepare deployment packages

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("netlify", "vercel", "railway", "all")]
    [string]$Platform
)

Write-Host "🚀 Collection Portal Deployment Preparation" -ForegroundColor Green
Write-Host "Platform: $Platform" -ForegroundColor Yellow

# Function to copy files
function Copy-AppFiles {
    param([string]$TargetPath)
    
    Write-Host "📁 Copying application files to $TargetPath..." -ForegroundColor Cyan
    
    # Copy main application directories
    Copy-Item -Path "app" -Destination "$TargetPath/" -Recurse -Force
    Copy-Item -Path "components" -Destination "$TargetPath/" -Recurse -Force
    Copy-Item -Path "lib" -Destination "$TargetPath/" -Recurse -Force
    Copy-Item -Path "types" -Destination "$TargetPath/" -Recurse -Force
    
    # Copy configuration files
    Copy-Item -Path "tailwind.config.js" -Destination "$TargetPath/" -Force
    Copy-Item -Path "postcss.config.js" -Destination "$TargetPath/" -Force
    Copy-Item -Path "tsconfig.json" -Destination "$TargetPath/" -Force
    Copy-Item -Path "next-env.d.ts" -Destination "$TargetPath/" -Force
    Copy-Item -Path "middleware.ts" -Destination "$TargetPath/" -Force
    
    Write-Host "✅ Files copied successfully!" -ForegroundColor Green
}

# Function to copy package.json
function Copy-PackageJson {
    param([string]$TargetPath)
    
    Write-Host "📦 Copying package.json..." -ForegroundColor Cyan
    Copy-Item -Path "package.json" -Destination "$TargetPath/" -Force
    Write-Host "✅ Package.json copied!" -ForegroundColor Green
}

# Main deployment logic
switch ($Platform) {
    "netlify" {
        Write-Host "🎯 Preparing Netlify deployment..." -ForegroundColor Yellow
        Copy-AppFiles "deploy-packages/netlify"
        Copy-PackageJson "deploy-packages/netlify"
        Write-Host "✅ Netlify package ready!" -ForegroundColor Green
        Write-Host "📖 See deploy-packages/netlify/DEPLOYMENT_GUIDE.md for instructions" -ForegroundColor Cyan
    }
    
    "vercel" {
        Write-Host "🎯 Preparing Vercel deployment..." -ForegroundColor Yellow
        Copy-AppFiles "deploy-packages/vercel"
        Copy-PackageJson "deploy-packages/vercel"
        Write-Host "✅ Vercel package ready!" -ForegroundColor Green
        Write-Host "📖 See deploy-packages/vercel/DEPLOYMENT_GUIDE.md for instructions" -ForegroundColor Cyan
    }
    
    "railway" {
        Write-Host "🎯 Preparing Railway deployment..." -ForegroundColor Yellow
        Copy-AppFiles "deploy-packages/railway"
        Copy-PackageJson "deploy-packages/railway"
        Write-Host "✅ Railway package ready!" -ForegroundColor Green
        Write-Host "📖 See deploy-packages/railway/DEPLOYMENT_GUIDE.md for instructions" -ForegroundColor Cyan
    }
    
    "all" {
        Write-Host "🎯 Preparing all deployment packages..." -ForegroundColor Yellow
        Copy-AppFiles "deploy-packages/netlify"
        Copy-AppFiles "deploy-packages/vercel"
        Copy-AppFiles "deploy-packages/railway"
        Copy-PackageJson "deploy-packages/netlify"
        Copy-PackageJson "deploy-packages/vercel"
        Copy-PackageJson "deploy-packages/railway"
        Write-Host "✅ All packages ready!" -ForegroundColor Green
        Write-Host "📖 See deploy-packages/README.md for comparison" -ForegroundColor Cyan
    }
}

Write-Host "🎉 Deployment preparation complete!" -ForegroundColor Green
Write-Host "💡 Next steps:" -ForegroundColor Yellow
Write-Host "   1. Set up environment variables" -ForegroundColor White
Write-Host "   2. Follow the deployment guide for your platform" -ForegroundColor White
Write-Host "   3. Deploy and test your application" -ForegroundColor White 