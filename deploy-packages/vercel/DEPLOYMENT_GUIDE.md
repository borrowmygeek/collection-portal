# 🚀 Vercel Deployment Guide

## Overview
Vercel is the **recommended platform** for Next.js applications with full serverless function support.

## ✅ Why Vercel?
- **Native Next.js support** - Built by the Next.js team
- **Zero configuration** - Automatic optimization
- **Global CDN** - Fast worldwide performance
- **Serverless Functions** - Full API route support
- **Automatic deployments** - Git integration

## 📋 Prerequisites
1. **Vercel Account** - Sign up at [vercel.com](https://vercel.com)
2. **GitHub/GitLab** - Code repository
3. **Supabase Project** - Database ready

## 🚀 Quick Deploy

### Option 1: Vercel CLI (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Follow prompts to configure
```

### Option 2: Git Integration
1. **Push to GitHub/GitLab**
2. **Import project** in Vercel dashboard
3. **Auto-deploy** on every push

### Option 3: Drag & Drop
1. **Build locally:** `npm run build`
2. **Upload** to Vercel dashboard
3. **Configure environment variables**

## 🔧 Environment Variables

Set in Vercel Dashboard → Project Settings → Environment Variables:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## 📁 File Structure
```
deploy-packages/vercel/
├── vercel.json           # Vercel configuration
├── package.json          # Dependencies
├── DEPLOYMENT_GUIDE.md   # This file
└── [Copy entire app/]    # Your application files
```

## 🎯 Features Working
- ✅ **API Routes** - Full serverless support
- ✅ **Authentication** - Supabase Auth with multi-role support
- ✅ **Database** - Real-time connections
- ✅ **File Uploads** - If implemented
- ✅ **Middleware** - Auth protection
- ✅ **ISR/SSG** - Static generation
- ✅ **Role Management** - Multi-role switching system
- ✅ **Buyer Management** - Complete buyer registration and approval system
- ✅ **Sales Portal** - Portfolio sales and management
- ✅ **Toast Notifications** - User feedback system
- ✅ **Advanced Filtering** - Search and filter capabilities
- ✅ **Responsive Design** - Mobile and desktop optimized

## 🚀 Performance
- **Edge Functions** - Global deployment
- **Image Optimization** - Automatic
- **Bundle Analysis** - Built-in
- **Analytics** - Performance monitoring
- **Function Optimization** - Specific timeouts for different API routes

## 🆕 New Features (Latest Update)
- **Role Switcher** - Users can switch between available roles from the sidebar
- **Buyer Management Interface** - Professional table-based interface for managing buyers
- **Sales Page Navigation** - Properly integrated sales page in sidebar navigation
- **Advanced Search & Filtering** - Enhanced buyer management with search and filters
- **Toast Notifications** - User feedback for role switches and other actions
- **Improved UX** - Better loading states, error handling, and responsive design

## 🐛 Troubleshooting

### Build Fails
- Check Node.js version (18+)
- Verify environment variables
- Check for TypeScript errors

### API Routes Not Working
- Verify function timeout (60s max for general, 30s for specific routes)
- Check environment variables
- Test locally first

### Database Issues
- Verify Supabase connection
- Check RLS policies
- Test with service role key

### Role Switching Issues
- Verify user has multiple roles assigned
- Check role permissions in database
- Ensure role session tokens are properly configured

## 📞 Support
- **Vercel Docs**: [vercel.com/docs](https://vercel.com/docs)
- **Next.js**: [nextjs.org/docs](https://nextjs.org/docs)
- **Community**: [github.com/vercel/vercel/discussions](https://github.com/vercel/vercel/discussions)

## 🎉 Success!
Your Collection Portal will be live at: `https://your-project.vercel.app`

## 🔄 Updating Deployment
To update your existing deployment with the latest changes:

```bash
# Deploy latest changes
vercel --prod

# Or for preview deployment
vercel
``` 