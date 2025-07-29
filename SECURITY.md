# Security Documentation - Collection Portal

## Overview

This document outlines the security measures implemented in the Collection Portal to protect against common web application vulnerabilities including SQL injection, XSS, CSRF, and other input-based attacks.

## 🔒 Security Layers

### 1. Input Validation & Sanitization

#### Zod Schema Validation
- **Location**: `lib/validation.ts`
- **Purpose**: Runtime type validation and data sanitization
- **Implementation**: All API endpoints use Zod schemas to validate input data

```typescript
// Example validation schema
export const createUserSchema = z.object({
  email: emailSchema,
  full_name: nameSchema,
  role: z.enum(['platform_admin', 'agency_admin', 'agency_user']),
  password: passwordSchema,
  agency_id: z.string().uuid().optional()
})
```

#### Input Sanitization Functions
- **Email**: Normalized to lowercase, removes invalid characters
- **Phone**: Strips non-numeric characters except +, -, (, ), spaces
- **Address**: Removes HTML tags, limits length
- **Names**: Trims whitespace, removes HTML tags
- **Codes**: Converts to uppercase, allows only A-Z, 0-9, _, -

### 2. SQL Injection Protection

#### Primary Protection: Supabase ORM
- **Method**: Uses Supabase query builder with parameterized queries
- **Status**: ✅ **ACTIVE** - All database operations use ORM
- **Example**:
```typescript
// Safe - parameterized query
const { data } = await supabase
  .from('platform_users')
  .select('*')
  .eq('email', userEmail) // Parameterized, not string concatenation
```

#### Secondary Protection: Input Validation
- **Method**: Zod schemas prevent malicious input from reaching database
- **Status**: ✅ **ACTIVE** - All inputs validated before processing

#### Tertiary Protection: SQL Injection Detection
- **Method**: Pattern matching for common SQL injection attempts
- **Status**: ✅ **ACTIVE** - Logs and blocks suspicious patterns
- **Patterns Detected**:
  - SQL keywords: `UNION`, `SELECT`, `INSERT`, `UPDATE`, `DELETE`
  - Comment patterns: `--`, `/*`, `*/`
  - Stored procedure calls: `xp_`, `sp_`, `fn_`

### 3. XSS (Cross-Site Scripting) Protection

#### Input Sanitization
- **Method**: Removes HTML tags and JavaScript from user input
- **Status**: ✅ **ACTIVE** - All text inputs sanitized
- **Example**:
```typescript
export function sanitizeString(input: string): string {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .substring(0, 1000) // Limit length
}
```

#### Output Encoding
- **Method**: HTML entities encoding for dynamic content
- **Status**: ✅ **ACTIVE** - React automatically escapes content

### 4. Authentication & Authorization

#### JWT Token Authentication
- **Method**: Supabase Auth with JWT tokens
- **Status**: ✅ **ACTIVE** - All API routes require authentication
- **Token Validation**: Server-side validation on every request

#### Role-Based Access Control (RBAC)
- **Roles**: `platform_admin`, `agency_admin`, `agency_user`
- **Status**: ✅ **ACTIVE** - All endpoints check user permissions
- **Implementation**: `requirePlatformAdmin()` and similar functions

#### Session Management
- **Method**: Secure HTTP-only cookies
- **Status**: ✅ **ACTIVE** - Supabase handles session security
- **Features**: Automatic token refresh, secure storage

### 5. Rate Limiting

#### API Rate Limiting
- **Method**: User-based rate limiting with Redis-like storage
- **Status**: ✅ **ACTIVE** - All API endpoints rate limited
- **Limits**:
  - GET requests: 100 per 15 minutes
  - POST requests: 10-20 per 5 minutes
  - Authentication endpoints: Stricter limits

### 6. Audit Logging

#### Comprehensive Logging
- **Method**: All user actions logged to audit table
- **Status**: ✅ **ACTIVE** - Complete audit trail
- **Logged Events**:
  - User creation, updates, deletions
  - Data access and modifications
  - Security violations
  - Authentication attempts
  - Rate limit violations

#### Security Event Logging
- **Method**: Dedicated security events table
- **Status**: ✅ **ACTIVE** - Real-time security monitoring
- **Events Logged**:
  - Failed authentication attempts
  - Permission violations
  - Input validation failures
  - Suspicious activity patterns

### 7. Data Protection

#### Row Level Security (RLS)
- **Method**: Database-level access control
- **Status**: ✅ **ACTIVE** - All tables have RLS policies
- **Implementation**: Supabase RLS policies enforce data access rules

#### Data Encryption
- **Method**: Supabase handles encryption at rest
- **Status**: ✅ **ACTIVE** - All data encrypted in database
- **Transport**: HTTPS/TLS for all communications

### 8. API Security

#### CORS Protection
- **Method**: Next.js CORS configuration
- **Status**: ✅ **ACTIVE** - Restricted to allowed origins

#### Request Validation
- **Method**: All API requests validated and sanitized
- **Status**: ✅ **ACTIVE** - Input validation on every endpoint

#### Error Handling
- **Method**: Generic error messages to prevent information leakage
- **Status**: ✅ **ACTIVE** - No sensitive data in error responses

## 🛡️ Security Checklist

### Input Validation ✅
- [x] All user inputs validated with Zod schemas
- [x] Input sanitization for all text fields
- [x] Type checking and conversion
- [x] Length limits on all inputs
- [x] Pattern validation for emails, phones, etc.

### SQL Injection Protection ✅
- [x] Supabase ORM with parameterized queries
- [x] No raw SQL queries in application code
- [x] Input validation prevents malicious data
- [x] SQL injection pattern detection
- [x] Database user has minimal privileges

### XSS Protection ✅
- [x] Input sanitization removes HTML/JS
- [x] React automatic content escaping
- [x] CSP headers (if needed)
- [x] Output encoding for dynamic content

### Authentication ✅
- [x] JWT token authentication
- [x] Secure session management
- [x] Password requirements enforced
- [x] Account lockout policies
- [x] Multi-factor authentication ready

### Authorization ✅
- [x] Role-based access control
- [x] Resource-level permissions
- [x] Row-level security policies
- [x] API endpoint protection

### Rate Limiting ✅
- [x] User-based rate limiting
- [x] Endpoint-specific limits
- [x] Rate limit headers
- [x] Automatic blocking

### Logging & Monitoring ✅
- [x] Comprehensive audit logging
- [x] Security event logging
- [x] Real-time monitoring
- [x] Alert system ready

### Data Protection ✅
- [x] Encryption at rest
- [x] Encryption in transit
- [x] Secure data disposal
- [x] Backup encryption

## 🚨 Security Incident Response

### Detection
1. **Automated Monitoring**: Security events logged automatically
2. **Manual Review**: Regular security log reviews
3. **User Reports**: Security incident reporting process

### Response
1. **Immediate**: Block suspicious IPs/users
2. **Investigation**: Review audit logs and security events
3. **Containment**: Isolate affected systems
4. **Recovery**: Restore from secure backups
5. **Post-Incident**: Update security measures

### Reporting
- All security incidents logged to audit table
- Security events trigger alerts
- Regular security reports generated

## 🔧 Security Configuration

### Environment Variables
```bash
# Required for security
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key

# Security settings
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### Database Security
- Row Level Security (RLS) enabled on all tables
- Database user has minimal required privileges
- Regular security updates applied
- Encrypted connections required

### Application Security
- HTTPS required in production
- Secure headers configured
- Content Security Policy ready
- Regular dependency updates

## 📋 Security Testing

### Automated Testing
- Input validation tests
- Authentication tests
- Authorization tests
- Rate limiting tests

### Manual Testing
- Penetration testing
- Security code reviews
- Vulnerability assessments

### Ongoing Monitoring
- Security log analysis
- Performance monitoring
- Error rate tracking
- User behavior analysis

## 📞 Security Contacts

For security issues or questions:
- **Security Team**: security@yourcompany.com
- **Emergency**: +1-XXX-XXX-XXXX
- **Bug Reports**: security-bugs@yourcompany.com

---

**Last Updated**: January 2025
**Version**: 1.0
**Next Review**: Quarterly