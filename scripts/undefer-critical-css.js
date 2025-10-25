#!/usr/bin/env node

/**
 * Revert critical CSS back to normal loading to prevent FOUC (flash of unstyled content)
 */

const fs = require('fs');
const { glob } = require('glob');

async function undeferCriticalCss() {
  console.log('Reverting critical CSS to normal loading...\n');

  const htmlFiles = await glob('**/*.html', {
    ignore: ['node_modules/**'],
    nodir: true,
    windowsPathsNoEscape: true
  });

  const criticalCssPatterns = [
    'kadence-global',
    'kadence-header',
    'kadence-content',
    'kadence-footer',
  ];

  let updated = 0;

  for (const file of htmlFiles) {
    let content = fs.readFileSync(file, 'utf8');
    let modified = false;

    // Find deferred critical CSS links
    const deferredLinkRegex = /<link\s+[^>]*rel=["']stylesheet["'][^>]*media=["']print["'][^>]*onload[^>]*>(?:<noscript>.*?<\/noscript>)?/gi;
    const matches = content.match(deferredLinkRegex) || [];

    for (const deferredTag of matches) {
      // Check if this is critical CSS
      const isCritical = criticalCssPatterns.some(pattern => deferredTag.includes(pattern));

      if (!isCritical) continue;

      // Extract the noscript version (which has the original link)
      const noscriptMatch = deferredTag.match(/<noscript>(.*?)<\/noscript>/);

      if (noscriptMatch) {
        const originalLink = noscriptMatch[1];
        content = content.replace(deferredTag, originalLink);
        modified = true;
      }
    }

    if (modified) {
      fs.writeFileSync(file, content, 'utf8');
      console.log(`  ✓ ${file}`);
      updated++;
    }
  }

  console.log(`\n✓ Reverted critical CSS in ${updated} files`);
  console.log('\nCritical CSS will now load normally to prevent flash of unstyled content!');
}

undeferCriticalCss().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
