# 🔒 RLS System Complete Rewrite Plan

## 📋 **Overview**

This document outlines the complete rewrite of the Row Level Security (RLS) system for the Collection Portal. The current system has become complex, recursive, and difficult to maintain. We will implement a clean, secure, and performant permission system.

## 🚨 **Security Protocol Compliance**

- ✅ **Full backup before changes** - Database and code backup
- ✅ **Git version control** - Complete project state preserved
- ✅ **Feature branch isolation** - Changes isolated from main branch
- ✅ **Rollback capability** - Emergency restore procedures documented
- ✅ **No destructive commands** - Safe backup/restore methods only

## 🔍 **Current Problems**

1. **RLS Recursion**: Policies query `user_roles` from within `user_roles` RLS
2. **Conflicting Policies**: Multiple migrations created overlapping rules
3. **Broken User Management**: Platform admins can't view other users' roles
4. **Authentication Issues**: Profile fetch times out due to RLS conflicts
5. **Inconsistent Models**: Mix of old `role` field and new `user_roles` table

## 🎯 **Goals**

1. **Eliminate RLS recursion** completely
2. **Implement clean permission hierarchy** with clear rules
3. **Fix authentication flow** for fast, reliable login
4. **Enable proper user management** for platform admins
5. **Create maintainable system** for future development

## 🏗️ **New Architecture**

### **Permission Hierarchy**
```
platform_admin
├── Full access to everything
├── Manage all users and roles
├── System configuration
└── Audit logs

agency_admin
├── Manage agency users
├── View agency data
├── Manage agency portfolios
└── Agency-specific settings

agency_user
├── View agency data
├── View assigned portfolios
├── Basic operations
└── Limited permissions

client_admin
├── Manage client data
├── View client portfolios
├── Client-specific settings
└── Limited user management

client_user
├── View client data
├── View assigned portfolios
├── Basic operations
└── Minimal permissions

buyer
├── View assigned portfolios
├── Basic operations
└── Minimal permissions
```

### **Core Tables Structure**
```sql
-- Users table (simplified)
platform_users
├── id (uuid, primary key)
├── auth_user_id (uuid, references auth.users)
├── email (text, unique)
├── full_name (text)
├── status (active/inactive/suspended)
└── created_at/updated_at

-- Roles table (clean, no recursion)
user_roles
├── id (uuid, primary key)
├── user_id (uuid, references platform_users)
├── role_type (platform_admin, agency_admin, etc.)
├── organization_type (platform, agency, client, buyer)
├── organization_id (uuid, nullable)
├── is_active (boolean)
├── is_primary (boolean)
├── permissions (jsonb)
└── created_at/updated_at

-- Role sessions (for role switching)
user_role_sessions
├── id (uuid, primary key)
├── user_id (uuid, references platform_users)
├── role_id (uuid, references user_roles)
├── session_token (text, unique)
├── expires_at (timestamptz)
└── created_at
```

## 🔧 **Implementation Plan**

### **Phase 1: Backup & Preparation** ⏱️ **Day 1**
1. **Run database backup script** (`scripts/backup-current-state.sql`)
2. **Execute git backup script** (`scripts/backup-to-git.ps1`)
3. **Verify backup integrity** and rollback procedures
4. **Create feature branch** for RLS rewrite

### **Phase 2: Core Permission System** ⏱️ **Days 2-3**
1. **Create new permission functions**:
   ```sql
   is_platform_admin(user_id)
   is_agency_admin(user_id, agency_id)
   get_user_permissions(user_id)
   get_user_primary_role(user_id)
   ```

2. **Implement clean RLS policies**:
   - No recursive queries
   - Simple, direct permission checks
   - Clear access control rules

3. **Update authentication flow**:
   - Fast profile fetch
   - No RLS conflicts
   - Efficient role resolution

### **Phase 3: User Management** ⏱️ **Days 4-5**
1. **Rewrite user management API**:
   - `/api/users` - List users with proper RLS
   - `/api/users/[id]` - User CRUD operations
   - `/api/users/[id]/roles` - Role management

2. **Update frontend components**:
   - User list with role display
   - Role assignment interface
   - Permission management

### **Phase 4: Testing & Validation** ⏱️ **Days 6-7**
1. **Comprehensive testing**:
   - Authentication flow
   - User management
   - Role switching
   - Permission enforcement

2. **Performance validation**:
   - Profile fetch speed
   - Database query performance
   - RLS policy efficiency

### **Phase 5: Deployment** ⏱️ **Day 8**
1. **Merge to main branch**
2. **Deploy to production**
3. **Monitor for issues**
4. **Document new system**

## 🚀 **Execution Commands**

### **Step 1: Database Backup**
```bash
# Run in Supabase SQL Editor
\i scripts/backup-current-state.sql
```

### **Step 2: Git Backup**
```powershell
# Run in PowerShell
.\scripts\backup-to-git.ps1
```

### **Step 3: Begin RLS Rewrite**
```bash
# You'll be on the feature branch after backup
# Begin implementing new permission system
```

## 🔒 **Security Measures**

1. **No direct table access** - All access through RLS policies
2. **Permission validation** - Server-side permission checks
3. **Audit logging** - Track all permission changes
4. **Session management** - Secure role switching
5. **Input validation** - Sanitize all user inputs

## 🚨 **Emergency Procedures**

### **If RLS Rewrite Fails**
```bash
# 1. Switch to backup branch
git checkout backup/rls-rewrite-[timestamp]

# 2. Restore database from backup
# Use backup_rls_rewrite schema

# 3. Delete feature branch
git branch -D feature/rls-rewrite-[timestamp]

# 4. Continue from backup state
```

### **If Authentication Breaks**
```bash
# 1. Check RLS policies
# 2. Verify permission functions
# 3. Test with minimal policies
# 4. Rollback if necessary
```

## 📊 **Success Metrics**

1. **Authentication**: Profile fetch < 2 seconds
2. **User Management**: Platform admins can view all users
3. **Performance**: No RLS recursion errors
4. **Security**: Proper permission enforcement
5. **Maintainability**: Clean, documented code

## 🔮 **Future Considerations**

1. **Role inheritance** - Hierarchical permission system
2. **Dynamic permissions** - Runtime permission changes
3. **Multi-tenant support** - Organization-level isolation
4. **Permission caching** - Performance optimization
5. **Audit trails** - Comprehensive logging

## 📝 **Documentation Requirements**

1. **Permission system guide** - How to use the new system
2. **RLS policy reference** - All policies documented
3. **API documentation** - Updated endpoints
4. **Migration guide** - For future changes
5. **Troubleshooting guide** - Common issues and solutions

---

**⚠️ IMPORTANT**: This is a major system change. Follow all security protocols and test thoroughly before deployment.
