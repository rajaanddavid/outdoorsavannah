#!/usr/bin/env node

/**
 * Defer non-critical CSS to eliminate render blocking
 * Uses the media="print" onload trick
 */

const fs = require('fs');
const { glob } = require('glob');

async function deferCss() {
  console.log('Deferring non-critical CSS...\n');

  const htmlFiles = await glob('**/*.html', {
    ignore: ['node_modules/**'],
    nodir: true,
    windowsPathsNoEscape: true
  });

  let updated = 0;

  for (const file of htmlFiles) {
    let content = fs.readFileSync(file, 'utf8');
    let modified = false;

    // Find all stylesheet link tags
    const linkRegex = /<link\s+[^>]*rel=["']stylesheet["'][^>]*>/gi;
    const matches = content.match(linkRegex) || [];

    for (const linkTag of matches) {
      // Skip if already deferred
      if (linkTag.includes('onload')) continue;
      if (linkTag.includes('inline')) continue;

      // Skip external CDN CSS (keep those render-blocking for reliability)
      if (/href=["']https?:\/\/(?!www\.outdoorsavannah\.com)/i.test(linkTag)) continue;

      let deferredTag;

      if (/media=["']all["']/i.test(linkTag)) {
        // Replace media="all" with media="print" and add onload
        deferredTag = linkTag.replace(/media=["']all["']/i, 'media="print" onload="this.media=\'all\'"');
      } else if (!/media=/i.test(linkTag)) {
        // No media attribute - add it
        deferredTag = linkTag.replace(/<link\s+/, '<link media="print" onload="this.media=\'all\'" ');
      } else {
        // Has other media attribute - skip
        continue;
      }

      // Add noscript fallback
      deferredTag += '<noscript>' + linkTag + '</noscript>';

      content = content.replace(linkTag, deferredTag);
      modified = true;
    }

    if (modified) {
      fs.writeFileSync(file, content, 'utf8');
      console.log(`  ✓ ${file}`);
      updated++;
    }
  }

  console.log(`\n✓ Deferred CSS in ${updated} files`);
  console.log('\nThis should eliminate render-blocking CSS!');
}

deferCss().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
