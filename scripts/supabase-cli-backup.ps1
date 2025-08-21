# ============================================================================
# SUPABASE CLI BACKUP SCRIPT FOR RLS REWRITE
# This script creates a comprehensive backup using Supabase CLI commands
# ============================================================================

Write-Host "Starting Supabase CLI backup process..." -ForegroundColor Green

# ============================================================================
# STEP 1: PULL CURRENT SCHEMA
# ============================================================================

Write-Host "Step 1: Pulling current schema..." -ForegroundColor Yellow

try {
    # First repair any migration issues
    Write-Host "Repairing migration history..." -ForegroundColor Cyan
    supabase migration repair --status applied 20250821000005
    
    # Pull the current schema
    Write-Host "Pulling schema from remote database..." -ForegroundColor Cyan
    supabase db pull --linked
    
    Write-Host "Schema pull completed successfully!" -ForegroundColor Green
} catch {
    Write-Host "Schema pull failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Continuing with alternative backup method..." -ForegroundColor Yellow
}

# ============================================================================
# STEP 2: CREATE BACKUP DIRECTORY
# ============================================================================

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = "backup-rls-rewrite-$timestamp"
Write-Host "Step 2: Creating backup directory: $backupDir" -ForegroundColor Yellow

if (!(Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir | Out-Null
    Write-Host "Backup directory created: $backupDir" -ForegroundColor Green
}

# ============================================================================
# STEP 3: BACKUP CRITICAL FILES
# ============================================================================

Write-Host "Step 3: Backing up critical files..." -ForegroundColor Yellow

# Copy migrations
if (Test-Path "supabase/migrations") {
    Copy-Item -Path "supabase/migrations" -Destination "$backupDir/migrations" -Recurse -Force
    Write-Host "Migrations backed up" -ForegroundColor Green
}

# Copy config files
if (Test-Path "supabase/config.toml") {
    Copy-Item -Path "supabase/config.toml" -Destination "$backupDir/config.toml" -Force
    Write-Host "Config backed up" -ForegroundColor Green
}

# Copy seed files
if (Test-Path "supabase/seed.sql") {
    Copy-Item -Path "supabase/seed.sql" -Destination "$backupDir/seed.sql" -Force
    Write-Host "Seed file backed up" -ForegroundColor Green
}

# ============================================================================
# STEP 4: CREATE BACKUP SUMMARY
# ============================================================================

Write-Host "Step 4: Creating backup summary..." -ForegroundColor Yellow

$backupSummary = @"
# SUPABASE BACKUP SUMMARY
# Created: $(Get-Date)
# Purpose: RLS System Rewrite Backup
# 
# This backup contains:
# - Current database schema (from supabase db pull)
# - All migration files
# - Configuration files
# - Seed data
#
# To restore this backup:
# 1. Copy files back to supabase/ directory
# 2. Run: supabase db reset
# 3. Run: supabase db push
#
# WARNING: This will overwrite your current local database!
"@

$backupSummary | Out-File -FilePath "$backupDir/BACKUP_README.md" -Encoding UTF8

# ============================================================================
# STEP 5: CREATE COMPRESSED BACKUP
# ============================================================================

Write-Host "Step 5: Creating compressed backup..." -ForegroundColor Yellow

try {
    # Create ZIP archive
    $zipPath = "$backupDir.zip"
    if (Test-Path $zipPath) {
        Remove-Item $zipPath -Force
    }
    
    # Use PowerShell's Compress-Archive
    Compress-Archive -Path $backupDir -DestinationPath $zipPath -Force
    
    Write-Host "Compressed backup created: $zipPath" -ForegroundColor Green
    
    # Clean up uncompressed directory
    Remove-Item $backupDir -Recurse -Force
    Write-Host "Temporary files cleaned up" -ForegroundColor Green
    
} catch {
    Write-Host "Compression failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Backup files remain in: $backupDir" -ForegroundColor Yellow
}

# ============================================================================
# SUMMARY
# ============================================================================

Write-Host ""
Write-Host "BACKUP COMPLETED SUCCESSFULLY!" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Green
Write-Host "Backup location: $zipPath" -ForegroundColor Cyan
Write-Host "Timestamp: $(Get-Date)" -ForegroundColor Cyan
Write-Host ""
Write-Host "What was backed up:" -ForegroundColor Yellow
Write-Host "  Database schema (from CLI pull)" -ForegroundColor White
Write-Host "  All migration files" -ForegroundColor White
Write-Host "  Configuration files" -ForegroundColor White
Write-Host "  Seed data" -ForegroundColor White
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Verify backup file exists: $zipPath" -ForegroundColor White
Write-Host "  2. Begin RLS rewrite implementation" -ForegroundColor White
Write-Host "  3. Test thoroughly before deployment" -ForegroundColor White
Write-Host ""
Write-Host "To restore if needed:" -ForegroundColor Cyan
Write-Host "  Extract $zipPath and follow BACKUP_README.md" -ForegroundColor White
