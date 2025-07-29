# 🚀 Railway Deployment Guide

## Overview
Railway is perfect for **full-stack applications** with database integration and serverless functions.

## ✅ Why Railway?
- **Full-stack support** - Frontend + Backend + Database
- **Database hosting** - PostgreSQL, MySQL, MongoDB
- **Serverless functions** - API routes work perfectly
- **Git integration** - Automatic deployments
- **Custom domains** - SSL included

## 📋 Prerequisites
1. **Railway Account** - Sign up at [railway.app](https://railway.app)
2. **GitHub/GitLab** - Code repository
3. **Supabase Project** - External database

## 🚀 Quick Deploy

### Option 1: Railway CLI
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Deploy
railway up

# Open dashboard
railway open
```

### Option 2: Git Integration
1. **Push to GitHub/GitLab**
2. **Connect repository** in Railway dashboard
3. **Auto-deploy** on every push

### Option 3: Manual Upload
1. **Create new project** in Railway
2. **Upload code** or connect Git
3. **Configure environment variables**

## 🔧 Environment Variables

Set in Railway Dashboard → Variables:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
NODE_ENV=production
```

## 📁 File Structure
```
deploy-packages/railway/
├── railway.toml         # Railway configuration
├── package.json         # Dependencies
├── DEPLOYMENT_GUIDE.md  # This file
└── [Copy entire app/]   # Your application files
```

## 🎯 Features Working
- ✅ **API Routes** - Full serverless support
- ✅ **Authentication** - Supabase Auth
- ✅ **Database** - External Supabase
- ✅ **Real-time** - WebSocket support
- ✅ **File Uploads** - If implemented
- ✅ **Custom Domains** - SSL included

## 🚀 Performance
- **Global CDN** - Fast worldwide access
- **Auto-scaling** - Based on traffic
- **Health checks** - Automatic monitoring
- **Logs** - Real-time debugging

## 🐛 Troubleshooting

### Build Fails
- Check Node.js version (18+)
- Verify environment variables
- Check for TypeScript errors

### API Routes Not Working
- Verify function timeout
- Check environment variables
- Test locally first

### Database Issues
- Verify Supabase connection
- Check RLS policies
- Test with service role key

## 💰 Pricing
- **Free tier** - $5 credit monthly
- **Pay-as-you-go** - Based on usage
- **Team plans** - Collaborative features

## 📞 Support
- **Railway Docs**: [docs.railway.app](https://docs.railway.app)
- **Discord**: [discord.gg/railway](https://discord.gg/railway)
- **GitHub**: [github.com/railwayapp/railway](https://github.com/railwayapp/railway)

## 🎉 Success!
Your Collection Portal will be live at: `https://your-project.railway.app` 