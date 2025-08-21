const fs = require('fs');
const path = require('path');

// Pattern to find and fix
const corruptionPattern = /import { authenticateApiRequest } from \['@\/lib\/auth-utils'\]\s*\n\n\n\s*return createClient\(supabaseUrl, supabaseServiceKey\)\s*}/g;

// Pattern to replace it with
const replacement = '';

// List of files that need fixing (based on grep search)
const filesToFix = [
  'app/api/agencies/[id]/route.ts',
  'app/api/auth/password-reset/route.ts',
  'app/api/buyers/[id]/route.ts',
  'app/api/clients/[id]/route.ts',
  'app/api/dashboard/stats/route.ts',
  'app/api/migrations/route.ts',
  'app/api/nda/route.ts',
  'app/api/import/cancel/route.ts',
  'app/api/nda/templates/route.ts',
  'app/api/import/preview/route.ts',
  'app/api/users/[id]/route.ts',
  'app/api/import/failed-rows/[jobId]/route.ts',
  'app/api/users/route.ts',
  'app/api/sales/route.ts',
  'app/api/nda/compliance/route.ts',
  'app/api/sales/stats/route.ts',
  'app/api/portfolio-placements/[id]/route.ts',
  'app/api/security/stats/route.ts',
  'app/api/portfolios/[id]/route.ts',
  'app/api/security/audit-logs/route.ts',
  'app/api/portfolios/[id]/stats/route.ts'
];

function fixCorruptedFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  File not found: ${filePath}`);
      return false;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    
    // Check if this file has the corruption
    if (corruptionPattern.test(content)) {
      console.log(`🔧 Fixing corruption in: ${filePath}`);
      
      // Fix the corruption
      content = content.replace(corruptionPattern, replacement);
      
      // Also fix the import statement if it's duplicated
      if (content.includes("import { createAdminSupabaseClient } from '@/lib/auth-utils'") && 
          content.includes("import { authenticateApiRequest } from '@/lib/auth-utils'")) {
        content = content.replace(
          "import { createAdminSupabaseClient } from '@/lib/auth-utils'\n\nimport { authenticateApiRequest } from '@/lib/auth-utils'",
          "import { createAdminSupabaseClient, authenticateApiRequest } from '@/lib/auth-utils'"
        );
      }
      
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Fixed corruption in: ${filePath}`);
      return true;
    } else {
      console.log(`ℹ️  No corruption found in: ${filePath}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error fixing ${filePath}:`, error.message);
    return false;
  }
}

function main() {
  console.log('🚀 Starting corruption fix...\n');
  
  let fixedCount = 0;
  let totalCount = filesToFix.length;

  for (const file of filesToFix) {
    if (fixCorruptedFile(file)) {
      fixedCount++;
    }
    console.log(''); // Add spacing between files
  }

  console.log(`\n🎉 Corruption fix complete! Fixed ${fixedCount} out of ${totalCount} files.`);
  
  if (fixedCount > 0) {
    console.log('\n📝 Next steps:');
    console.log('1. Test the build locally: npm run build');
    console.log('2. If successful, deploy to Vercel: vercel --prod');
  }
}

if (require.main === module) {
  main();
}

module.exports = { fixCorruptedFile, filesToFix };
