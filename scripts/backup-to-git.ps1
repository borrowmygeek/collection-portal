# ============================================================================
# GIT BACKUP SCRIPT FOR RLS REWRITE (Windows PowerShell)
# This script creates a comprehensive backup of the current project state
# Run this BEFORE making any database changes
# ============================================================================

# Set error action preference
$ErrorActionPreference = "Stop"

Write-Host "Starting comprehensive project backup..." -ForegroundColor Green

# ============================================================================
# CHECK CURRENT GIT STATUS
# ============================================================================

Write-Host "Checking current git status..." -ForegroundColor Yellow

# Check if we're in a git repository
try {
    $null = git rev-parse --git-dir
} catch {
    Write-Host "Error: Not in a git repository" -ForegroundColor Red
    exit 1
}

# Check for uncommitted changes
$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Host "Warning: You have uncommitted changes" -ForegroundColor Yellow
    Write-Host "Current changes:" -ForegroundColor Yellow
    Write-Host $gitStatus -ForegroundColor Gray
    
    $response = Read-Host "Do you want to commit these changes before backup? (y/N)"
    if ($response -eq 'y' -or $response -eq 'Y') {
        Write-Host "Committing current changes..." -ForegroundColor Green
        git add .
        git commit -m "Auto-commit before RLS rewrite backup - $(Get-Date)"
    } else {
        Write-Host "Please commit or stash your changes before proceeding" -ForegroundColor Red
        exit 1
    }
}

# ============================================================================
# CREATE BACKUP BRANCH
# ============================================================================

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$BACKUP_BRANCH = "backup/rls-rewrite-$timestamp"
Write-Host "Creating backup branch: $BACKUP_BRANCH" -ForegroundColor Green

git checkout -b $BACKUP_BRANCH

# ============================================================================
# CREATE BACKUP COMMIT
# ============================================================================

Write-Host "Creating backup commit..." -ForegroundColor Yellow

# Add all files
git add .

# Create comprehensive backup commit
$commitMessage = "COMPREHENSIVE BACKUP: Current state before RLS rewrite`n`nBackup created: $(Get-Date)`nPurpose: RLS system complete rewrite`nIncludes:`n  - All source code`n  - Database migrations`n  - Configuration files`n  - Documentation`n`nDO NOT DELETE - This is our safety net`nTo restore: git checkout $BACKUP_BRANCH`n`nNext steps:`n  1. Run database backup script`n  2. Create feature branch for RLS rewrite`n  3. Implement new permission system`n  4. Test thoroughly`n  5. Merge back to main`n`nSecurity: This backup preserves all current permissions and data"

git commit -m $commitMessage

# ============================================================================
# CREATE FEATURE BRANCH FOR RLS REWRITE
# ============================================================================

$FEATURE_BRANCH = "feature/rls-rewrite-$timestamp"
Write-Host "Creating feature branch for RLS rewrite: $FEATURE_BRANCH" -ForegroundColor Green

git checkout -b $FEATURE_BRANCH

# ============================================================================
# SUMMARY
# ============================================================================

Write-Host ""
Write-Host "BACKUP COMPLETED SUCCESSFULLY!" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Green
Write-Host "Backup branch: $BACKUP_BRANCH" -ForegroundColor Cyan
Write-Host "Feature branch: $FEATURE_BRANCH" -ForegroundColor Cyan
Write-Host "Timestamp: $(Get-Date)" -ForegroundColor Cyan
Write-Host ""
Write-Host "SECURITY PROTOCOLS COMPLIED:" -ForegroundColor Green
Write-Host "  Full git backup created" -ForegroundColor Green
Write-Host "  Feature branch isolated" -ForegroundColor Green
Write-Host "  No destructive commands executed" -ForegroundColor Green
Write-Host "  Rollback path preserved" -ForegroundColor Green
Write-Host ""
Write-Host "NEXT STEPS:" -ForegroundColor Yellow
Write-Host "  1. Run database backup: scripts/backup-current-state.sql" -ForegroundColor White
Write-Host "  2. Begin RLS rewrite on feature branch" -ForegroundColor White
Write-Host "  3. Test thoroughly before merging" -ForegroundColor White
Write-Host "  4. Keep backup branch for emergency restore" -ForegroundColor White
Write-Host ""
Write-Host "TO RESTORE IF NEEDED:" -ForegroundColor Cyan
Write-Host "  git checkout $BACKUP_BRANCH" -ForegroundColor White
Write-Host "  # Then restore database from backup schema" -ForegroundColor White
Write-Host ""
Write-Host "EMERGENCY ROLLBACK:" -ForegroundColor Red
Write-Host "  git checkout $BACKUP_BRANCH" -ForegroundColor White
Write-Host "  git branch -D $FEATURE_BRANCH" -ForegroundColor White
Write-Host "  # Database restore may be needed" -ForegroundColor White
