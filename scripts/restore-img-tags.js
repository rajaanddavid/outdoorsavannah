#!/usr/bin/env node

/**
 * Restore <img> tags from <picture> elements
 * This strips out <picture> wrappers and keeps just the fallback <img> tag
 */

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

async function restoreImgTags() {
  console.log('Restoring <img> tags from <picture> elements...\n');

  // Get the root directory (parent of scripts folder)
  const rootDir = path.join(__dirname, '..');

  // Change to root directory for glob
  process.chdir(rootDir);

  const htmlFiles = await glob('**/*.html', {
    ignore: ['node_modules/**'],
    nodir: true,
    windowsPathsNoEscape: true
  });

  let updated = 0;

  for (const file of htmlFiles) {
    let content = fs.readFileSync(file, 'utf8');
    let modified = false;

    // Match <picture> ... <img ...> ... </picture> and extract just the <img>
    // Use non-greedy matching and handle nested picture tags
    let newContent = content;
    let prevContent;

    // Keep removing picture tags until no more are found (handles nesting)
    // Remove any leading whitespace before <picture> to prevent accumulation
    do {
      prevContent = newContent;
      newContent = newContent.replace(/\s*<picture>[\s\S]*?(<img[^>]*>)[\s\S]*?<\/picture>/gi, (_match, imgTag) => {
        modified = true;
        // Return just the img tag, without any whitespace
        return imgTag;
      });
    } while (newContent !== prevContent);

    // Remove <figure class="wp-block-image..."> wrappers added by make-images-responsive.js
    // This handles cases where the figure was added by the script and needs to be removed
    newContent = newContent.replace(/<figure class="wp-block-image[^"]*">\s*(<img[^>]*>)\s*<\/figure>/gi, '$1');

    // Clean up any orphaned </picture> or </figure> tags that might be left
    newContent = newContent.replace(/\s*<\/picture>\s*<\/figure>/gi, '');
    newContent = newContent.replace(/\s*<\/picture>/gi, '');

    if (modified || newContent !== content) {
      fs.writeFileSync(file, newContent, 'utf8');
      console.log(`  ✓ ${file}`);
      updated++;
    }
  }

  console.log(`\n✓ Restored <img> tags in ${updated} files`);
  console.log('\nNow run: npm run make-responsive');
}

restoreImgTags().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
