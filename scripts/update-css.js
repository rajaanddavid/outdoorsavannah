const fs = require('fs');
const path = require('path');

// Get the root directory (parent of scripts folder)
const rootDir = path.join(__dirname, '..');

// Read the critical CSS content
const criticalCSS = fs.readFileSync(path.join(rootDir, 'criticalcss'), 'utf8');

// Critical CSS to be inlined (wrapped in style tags)
const inlineCriticalCSS = `<style id="custom-critical-css">
${criticalCSS}</style>`;

// External CSS link to be added (with preload for performance)
const externalCSSLink = `<link rel="preload" href="/css/custom.css" as="style">
<link rel="stylesheet" href="/css/custom.css">`;

// List of HTML files to update (excluding /affiliate folder)
const filesToUpdate = [
  '404.html',
  'redirect.html',
  'index.html',
  'about/index.html',
  'contact/index.html',
  'licensing/index.html',
  'privacy-policy/index.html',
  'product/index.html',
  'cat-shelf-guide-test/index.html',
  'cat-shelf-guide-email/index.html',
  'cat-shelf-guide/index.html',
  'product/wall-crawler-gecko/index.html',
  'product/string-toy/index.html',
  'product/sleepypod-mobile-cat-bed/index.html',
  'product/shelf-brackets/index.html',
  'product/rolling-ball-toy/index.html',
  'product/mobile-water-bowl/index.html',
  'product/leash/index.html',
  'product/harness/index.html',
  'product/feather-wand/index.html',
  'product/cat-shelves/index.html',
  'product/backpack/index.html'
];

let updatedCount = 0;
let errorCount = 0;

console.log('Updating HTML files with critical CSS + external CSS link...\n');

filesToUpdate.forEach(file => {
  try {
    const filePath = path.join(rootDir, file);

    if (!fs.existsSync(filePath)) {
      console.log(`  ⚠ Skipped: ${file} (file not found)`);
      return;
    }

    let content = fs.readFileSync(filePath, 'utf8');

    // Remove old custom CSS if it exists
    // Pattern 1: Remove everything from "BLOCKBASE THEME CUSTOMIZATION" comment to the end of that style tag
    content = content.replace(
      /\/\* ========================================\s*BLOCKBASE THEME CUSTOMIZATION[\s\S]*?<\/style>/gm,
      ''
    );

    // Pattern 2: Remove any existing custom-critical-css style tag
    content = content.replace(
      /<style id="custom-critical-css">[\s\S]*?<\/style>/gm,
      ''
    );

    // Pattern 3: Remove any existing external CSS links to custom.css
    content = content.replace(
      /<link rel="preload" href="\/css\/custom\.css"[^>]*>\s*/gm,
      ''
    );
    content = content.replace(
      /<link rel="stylesheet" href="\/css\/custom\.css"[^>]*>\s*/gm,
      ''
    );

    // Find the end of the global-styles-inline-css style tag
    const globalStylesEndMatch = content.match(/<style id="global-styles-inline-css">[\s\S]*?<\/style>/);

    if (!globalStylesEndMatch) {
      console.log(`  ✗ Error: ${file} - Could not find global-styles-inline-css tag`);
      errorCount++;
      return;
    }

    const insertPosition = globalStylesEndMatch.index + globalStylesEndMatch[0].length;

    // Insert critical CSS inline + external CSS link
    const before = content.substring(0, insertPosition);
    const after = content.substring(insertPosition);

    const newContent = before + '\n' + inlineCriticalCSS + '\n' + externalCSSLink + after;

    // Write the updated content back to the file
    fs.writeFileSync(filePath, newContent, 'utf8');

    console.log(`  ✓ Updated: ${file}`);
    updatedCount++;

  } catch (error) {
    console.log(`  ✗ Error: ${file} - ${error.message}`);
    errorCount++;
  }
});

console.log(`\n✓ Complete! Updated ${updatedCount} files${errorCount > 0 ? `, ${errorCount} errors` : ''}`);
console.log('\nPerformance optimization applied:');
console.log('  • Critical CSS: Inlined for instant render');
console.log('  • Non-critical CSS: External file with preload');
console.log('  • Result: Fastest possible page load!\n');
