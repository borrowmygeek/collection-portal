# Collection Portal - Agency Management Platform

A modern, enterprise-grade platform for managing multi-instance debt collection agencies with complete data isolation, automated billing, and compliance features.

## 🚀 Features

### Core Platform
- **Multi-Instance Architecture** - Each agency gets their own Supabase instance
- **Complete Data Isolation** - No data sharing between agencies
- **Automated Billing** - Usage-based billing with detailed tracking
- **Compliance Ready** - PCI DSS, FDCPA, audit logging built-in
- **Scalable Design** - Independent scaling per agency

### Agency Management
- **Dashboard Overview** - Key metrics and recent activity
- **Agency CRUD** - Create, read, update, delete agencies
- **Subscription Management** - Tier-based pricing (Basic, Professional, Enterprise)
- **Usage Tracking** - Storage, compute, API calls, bandwidth
- **Billing System** - Automated invoicing and payment tracking

### Security & Compliance
- **Row Level Security (RLS)** - Data access control per agency
- **Audit Logging** - Complete audit trail for compliance
- **PCI DSS Ready** - Payment processing compliance
- **Data Retention** - Configurable retention policies

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    MASTER INSTANCE                          │
│                 ✅ SUCCESSFULLY DEPLOYED                    │
├─────────────────────────────────────────────────────────────┤
│ • Agency Management & Billing                              │
│ • Client & Portfolio Management                            │
│ • Usage Tracking & Analytics                               │
│ • Security & Compliance                                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Agency A      │    │   Agency B      │    │   Agency C      │
│   Instance      │    │   Instance      │    │   Instance      │
│   (Next Phase)  │    │   (Next Phase)  │    │   (Next Phase)  │
│                 │    │                 │    │                 │
│ • Debtors       │    │ • Debtors       │    │ • Debtors       │
│ • Collections   │    │ • Collections   │    │ • Collections   │
│ • Skip-trace    │    │ • Skip-trace    │    │ • Skip-trace    │
│ • Payments      │    │ • Payments      │    │ • Payments      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📊 Database Schema

### Master Instance Tables
| Table | Purpose | Key Features |
|-------|---------|--------------|
| `master_agencies` | Agency management | Multi-tenant, billing, features |
| `master_clients` | Client/creditor management | Compliance, licensing |
| `master_portfolios` | Debt portfolio tracking | Financial metrics, placement |
| `master_portfolio_placements` | Agency assignments | Contingency rates, terms |
| `agency_usage` | Resource tracking | Storage, compute, API usage |
| `agency_billing` | Billing management | Automated invoicing |
| `platform_analytics` | Platform metrics | Revenue, performance tracking |
| `audit_logs` | Security audit | Compliance, security |

## 🛠️ Technology Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS, Headless UI
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Real-time**: Supabase Realtime
- **Deployment**: Vercel (recommended)

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Supabase account

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd collection-portal
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Add your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📋 Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run apply-migration` - Apply database migrations
- `npm run verify-migration` - Verify migration status

## 🎯 Platform Features

### Dashboard
- **Overview Metrics** - Total agencies, active agencies, revenue
- **Recent Activity** - Latest agency, client, and portfolio updates
- **Quick Actions** - Add agency, create client, view analytics

### Agency Management
- **Agency List** - View all agencies with search and filtering
- **Add Agency** - Comprehensive form with validation
- **Agency Details** - View and edit agency information
- **Status Management** - Active, suspended, inactive, provisioning

### Subscription Tiers
- **Basic** - $99/month, 10 users, 100 portfolios
- **Professional** - $299/month, 50 users, 500 portfolios
- **Enterprise** - Custom pricing, unlimited users/portfolios

### Integrations Ready
- **Vonage** - Communications and SMS
- **TLO** - Skip-tracing and data services
- **Experian** - Credit data and reports
- **Drop.co** - Payment processing

## 🔧 Development

### Project Structure
```
collection-portal/
├── app/                    # Next.js app directory
│   ├── agencies/          # Agency management pages
│   ├── clients/           # Client management pages
│   ├── portfolios/        # Portfolio management pages
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Dashboard page
├── components/            # Reusable components
│   ├── DashboardHeader.tsx
│   ├── Sidebar.tsx
│   ├── StatsGrid.tsx
│   ├── AgencyCard.tsx
│   ├── RecentActivity.tsx
│   └── AddAgencyModal.tsx
├── lib/                   # Utilities and configurations
│   └── supabase.ts        # Supabase client and types
├── scripts/               # Database scripts
│   ├── apply-migration.js
│   ├── verify-migration.js
│   └── show-migration.js
└── supabase/              # Supabase configuration
    ├── config.toml
    └── migrations/
```

### Database Migration
The master schema has been successfully deployed to Supabase. To verify:

```bash
npm run verify-migration
```

### Adding New Features
1. Create new components in `components/`
2. Add pages in `app/` directory
3. Update types in `lib/supabase.ts`
4. Add database migrations if needed

## 🔒 Security

- **Row Level Security (RLS)** enabled on all tables
- **Platform admin** policies for full access
- **Agency-specific** access policies
- **Audit logging** for all data changes
- **Input validation** on all forms

## 📈 Performance

- **Optimized indexes** on common query patterns
- **Efficient joins** with proper foreign keys
- **JSONB storage** for flexible metadata
- **Automated triggers** for timestamp management

## 🚀 Deployment

### Vercel (Recommended)
1. Connect your GitHub repository
2. Set environment variables
3. Deploy automatically

### Manual Deployment
1. Build the project: `npm run build`
2. Start production server: `npm run start`

## 📞 Support

For questions or issues:
1. Check the documentation
2. Review the database schema
3. Test with sample data
4. Contact the development team

## 🎉 Status

**✅ Master Schema Deployed** - All 8 tables created successfully  
**✅ Agency Management Platform** - Dashboard and CRUD operations ready  
**✅ Multi-Instance Architecture** - Foundation for agency instances  
**🚧 Next Phase** - Agency instance provisioning system  

---

**Built with ❤️ using Next.js, Supabase, and modern cloud architecture** 