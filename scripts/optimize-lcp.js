#!/usr/bin/env node

/**
 * Optimize Largest Contentful Paint (LCP) by prioritizing first large image
 * - Removes loading="lazy" from first large image in main content
 * - Adds fetchpriority="high" to ensure browser prioritizes it
 */

const fs = require('fs');
const { glob } = require('glob');

async function optimizeLCP() {
  console.log('Optimizing LCP images...\n');

  const htmlFiles = await glob('**/*.html', {
    ignore: ['node_modules/**'],
    nodir: true,
    windowsPathsNoEscape: true
  });

  let updated = 0;

  for (const file of htmlFiles) {
    let content = fs.readFileSync(file, 'utf8');
    let modified = false;

    // Find the entry-content section
    const entryContentMatch = content.match(/<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>/);

    if (!entryContentMatch) {
      continue; // Skip if no entry-content section
    }

    const entryContentStart = entryContentMatch.index;
    const entryContent = entryContentMatch[0];

    // Find first large image in entry-content (size-large or size-full)
    const firstLargeImgMatch = entryContent.match(/<img[^>]*class="[^"]*(?:size-large|size-full|wp-image-\d+)[^"]*"[^>]*>/);

    if (!firstLargeImgMatch) {
      continue; // Skip if no large images found
    }

    let imgTag = firstLargeImgMatch[0];
    let newImgTag = imgTag;

    // Remove loading="lazy" if present
    if (/loading=["']lazy["']/i.test(imgTag)) {
      newImgTag = newImgTag.replace(/\s*loading=["']lazy["']/gi, '');
      modified = true;
    }

    // Add fetchpriority="high" if not present
    if (!/fetchpriority=/i.test(imgTag)) {
      newImgTag = newImgTag.replace(/<img\s+/, '<img fetchpriority="high" ');
      modified = true;
    }

    if (modified) {
      // Replace only the first occurrence within entry-content
      const beforeContent = content.substring(0, entryContentStart);
      const afterContent = content.substring(entryContentStart);
      const updatedAfterContent = afterContent.replace(imgTag, newImgTag);

      content = beforeContent + updatedAfterContent;
      fs.writeFileSync(file, content, 'utf8');
      console.log(`  ✓ ${file}`);
      updated++;
    }
  }

  console.log(`\n✓ Optimized LCP in ${updated} files`);
  console.log('\nFirst large image in each page will now load with high priority!');
}

optimizeLCP().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
