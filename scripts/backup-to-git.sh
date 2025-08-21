#!/bin/bash

# ============================================================================
# GIT BACKUP SCRIPT FOR RLS REWRITE
# This script creates a comprehensive backup of the current project state
# Run this BEFORE making any database changes
# ============================================================================

set -e  # Exit on any error

echo "🔒 Starting comprehensive project backup..."

# ============================================================================
# CHECK CURRENT GIT STATUS
# ============================================================================

echo "📋 Checking current git status..."

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "❌ Error: Not in a git repository"
    exit 1
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "⚠️  Warning: You have uncommitted changes"
    echo "📝 Current changes:"
    git status --porcelain
    
    read -p "Do you want to commit these changes before backup? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "💾 Committing current changes..."
        git add .
        git commit -m "Auto-commit before RLS rewrite backup - $(date)"
    else
        echo "❌ Please commit or stash your changes before proceeding"
        exit 1
    fi
fi

# ============================================================================
# CREATE BACKUP BRANCH
# ============================================================================

BACKUP_BRANCH="backup/rls-rewrite-$(date +%Y%m%d-%H%M%S)"
echo "🌿 Creating backup branch: $BACKUP_BRANCH"

git checkout -b "$BACKUP_BRANCH"

# ============================================================================
# CREATE BACKUP COMMIT
# ============================================================================

echo "📦 Creating backup commit..."

# Add all files
git add .

# Create comprehensive backup commit
git commit -m "🔒 COMPREHENSIVE BACKUP: Current state before RLS rewrite

📅 Backup created: $(date)
🔧 Purpose: RLS system complete rewrite
📊 Includes:
  - All source code
  - Database migrations
  - Configuration files
  - Documentation

⚠️  DO NOT DELETE - This is our safety net
🔄 To restore: git checkout $BACKUP_BRANCH

📋 Next steps:
  1. Run database backup script
  2. Create feature branch for RLS rewrite
  3. Implement new permission system
  4. Test thoroughly
  5. Merge back to main

🔒 Security: This backup preserves all current permissions and data"

# ============================================================================
# CREATE FEATURE BRANCH FOR RLS REWRITE
# ============================================================================

FEATURE_BRANCH="feature/rls-rewrite-$(date +%Y%m%d-%H%M%S)"
echo "🚀 Creating feature branch for RLS rewrite: $FEATURE_BRANCH"

git checkout -b "$FEATURE_BRANCH"

# ============================================================================
# SUMMARY
# ============================================================================

echo ""
echo "✅ BACKUP COMPLETED SUCCESSFULLY!"
echo "=================================="
echo "📁 Backup branch: $BACKUP_BRANCH"
echo "🚀 Feature branch: $FEATURE_BRANCH"
echo "📅 Timestamp: $(date)"
echo ""
echo "🔒 SECURITY PROTOCOLS COMPLIED:"
echo "  ✅ Full git backup created"
echo "  ✅ Feature branch isolated"
echo "  ✅ No destructive commands executed"
echo "  ✅ Rollback path preserved"
echo ""
echo "📋 NEXT STEPS:"
echo "  1. Run database backup: scripts/backup-current-state.sql"
echo "  2. Begin RLS rewrite on feature branch"
echo "  3. Test thoroughly before merging"
echo "  4. Keep backup branch for emergency restore"
echo ""
echo "🔄 TO RESTORE IF NEEDED:"
echo "  git checkout $BACKUP_BRANCH"
echo "  # Then restore database from backup schema"
echo ""
echo "🚨 EMERGENCY ROLLBACK:"
echo "  git checkout $BACKUP_BRANCH"
echo "  git branch -D $FEATURE_BRANCH"
echo "  # Database restore may be needed"
