const fs = require('fs');
const path = require('path');

// List of API routes that need fixing
const apiRoutes = [
  'app/api/buyers/[id]/route.ts',
  'app/api/clients/[id]/route.ts',
  'app/api/debtors/route.ts',
  'app/api/auth/password-reset/route.ts',
  'app/api/admin/clear-import-data/route.ts',
  'app/api/dashboard/stats/route.ts',
  'app/api/agencies/[id]/route.ts',
  'app/api/import/cancel/route.ts',
  'app/api/import/preview/route.ts',
  'app/api/import/route.ts',
  'app/api/import/process/route.ts',
  'app/api/import/validate/route.ts',
  'app/api/import/templates/route.ts',
  'app/api/import/templates/[id]/route.ts',
  'app/api/import/failed-rows/[jobId]/route.ts',
  'app/api/nda/route.ts',
  'app/api/portfolios/[id]/route.ts',
  'app/api/security/stats/route.ts',
  'app/api/sales/route.ts',
  'app/api/nda/compliance/route.ts',
  'app/api/nda/templates/route.ts',
  'app/api/users/route.ts',
  'app/api/portfolios/[id]/stats/route.ts',
  'app/api/portfolio-placements/[id]/route.ts',
  'app/api/sales/stats/route.ts',
  'app/api/security/audit-logs/route.ts',
  'app/api/users/[id]/route.ts',
  'app/api/migrations/route.ts'
];

function fixApiRoute(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  File not found: ${filePath}`);
      return false;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Check if this file needs fixing
    if (content.includes('createClient(') && content.includes('process.env.NEXT_PUBLIC_SUPABASE_URL')) {
      console.log(`🔧 Fixing: ${filePath}`);

      // Replace import statement
      if (content.includes("import { createClient } from '@supabase/supabase-js'")) {
        content = content.replace(
          "import { createClient } from '@supabase/supabase-js'",
          "import { createAdminSupabaseClient } from '@/lib/auth-utils'"
        );
        modified = true;
      }

      // Remove local createAdminSupabaseClient function
      const functionRegex = /\/\/ Create admin client for data operations\s+const createAdminSupabaseClient = \(\) => \{[^}]*\}/s;
      if (functionRegex.test(content)) {
        content = content.replace(functionRegex, '');
        modified = true;
      }

      // Change dynamic to runtime=edge
      if (content.includes('export const dynamic = \'force-dynamic\'')) {
        content = content.replace(
          'export const dynamic = \'force-dynamic\'',
          'export const runtime = \'edge\''
        );
        modified = true;
      }

      // Add runtime=edge if it doesn't exist
      if (!content.includes('export const runtime = \'edge\'')) {
        const importMatch = content.match(/import.*from.*['"]@\/lib\/auth-utils['"]/);
        if (importMatch) {
          const insertIndex = content.indexOf(importMatch[0]) + importMatch[0].length;
          content = content.slice(0, insertIndex) + '\n\nexport const runtime = \'edge\'\n' + content.slice(insertIndex);
          modified = true;
        }
      }

      if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`✅ Fixed: ${filePath}`);
        return true;
      } else {
        console.log(`ℹ️  No changes needed: ${filePath}`);
        return false;
      }
    } else {
      console.log(`ℹ️  Already fixed or doesn't need fixing: ${filePath}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error fixing ${filePath}:`, error.message);
    return false;
  }
}

function main() {
  console.log('🚀 Starting API route fixes...\n');
  
  let fixedCount = 0;
  let totalCount = apiRoutes.length;

  for (const route of apiRoutes) {
    if (fixApiRoute(route)) {
      fixedCount++;
    }
    console.log(''); // Add spacing between files
  }

  console.log(`\n🎉 Fix complete! Fixed ${fixedCount} out of ${totalCount} routes.`);
  
  if (fixedCount > 0) {
    console.log('\n📝 Next steps:');
    console.log('1. Test the build locally: npm run build');
    console.log('2. If successful, deploy to Vercel: vercel --prod');
  }
}

if (require.main === module) {
  main();
}

module.exports = { fixApiRoute, apiRoutes };
