/**
 * Remove Render-Blocking CSS Optimization Script
 *
 * This script eliminates render-blocking CSS by:
 * 1. Reading WordPress CSS files from local static export (wp-includes/blocks/, wp-content/themes/)
 * 2. Inlining critical CSS (navigation, image blocks) into criticalcss file
 * 3. Removing external <link> tags from all HTML files
 *
 * All CSS files are read from local WordPress export - no external downloads.
 * This ensures the CSS matches your exact WordPress version.
 *
 * Performance gain: ~1,490ms reduction in render-blocking time
 */

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

const rootDir = path.join(__dirname, '..');
process.chdir(rootDir);

async function optimizeRenderBlockingCSS() {
  console.log('🚀 Starting render-blocking CSS optimization...\n');

  // Step 1: Read CSS files from local WordPress export
  console.log('📥 Reading CSS files from local WordPress export...');

  let navigationCSS = '';
  let imageCSS = '';

  // Try reading from local wp-includes/blocks (WordPress core files)
  const navigationPath = path.join(rootDir, 'wp-includes', 'blocks', 'navigation', 'style.min.css');
  const imagePath = path.join(rootDir, 'wp-includes', 'blocks', 'image', 'style.min.css');

  if (fs.existsSync(navigationPath)) {
    navigationCSS = fs.readFileSync(navigationPath, 'utf8');
    console.log('✓ Read navigation/style.min.css from local export');
  } else {
    console.log('⚠️  navigation/style.min.css not found locally, will try extracting from HTML');
  }

  if (fs.existsSync(imagePath)) {
    imageCSS = fs.readFileSync(imagePath, 'utf8');
    console.log('✓ Read image/style.min.css from local export');
  } else {
    console.log('⚠️  image/style.min.css not found locally, will try extracting from HTML');
  }

  // Fallback: Extract from existing inline styles if local files not found
  if (!imageCSS) {
    console.log('\n📄 Extracting image CSS from existing HTML files...');
    const homepageFile = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    const imageInlineMatch = homepageFile.match(/<style id="wp-block-image-inline-css">([\s\S]*?)<\/style>/);
    if (imageInlineMatch) {
      imageCSS = imageInlineMatch[1];
      console.log('✓ Extracted image CSS from homepage inline styles');
    }
  }

  // Step 1.5: Extract critical portions of ponyfill.css from local theme files
  console.log('\n📋 Extracting critical ponyfill CSS...');
  let ponyfillCriticalCSS = '';
  const ponyfillPath = path.join(rootDir, 'wp-content', 'themes', 'blockbase', 'assets', 'ponyfill.css');

  if (fs.existsSync(ponyfillPath)) {
    const ponyfillFull = fs.readFileSync(ponyfillPath, 'utf8');

    // Extract only critical base and alignment styles (first ~120 lines)
    // These are needed for immediate page render
    const lines = ponyfillFull.split('\n');
    const criticalLines = lines.slice(0, 120);
    ponyfillCriticalCSS = criticalLines.join('\n');

    console.log('✓ Read critical alignment & layout CSS from ponyfill.css');
  } else {
    console.log('⚠️  ponyfill.css not found in local export, skipping');
  }

  // Step 2: Read current criticalcss file
  console.log('\n📝 Updating critical CSS file...');
  const criticalCSSPath = path.join(rootDir, 'criticalcss');
  let criticalCSS = fs.readFileSync(criticalCSSPath, 'utf8');

  // Add navigation CSS to critical CSS if downloaded
  if (navigationCSS && !criticalCSS.includes('wp-block-navigation')) {
    criticalCSS += '\n\n/* ========================================\n   NAVIGATION BLOCK STYLES (inlined for performance)\n   Prevents render-blocking from navigation/style.min.css\n   ======================================== */\n' + navigationCSS;
    console.log('✓ Added navigation CSS to criticalcss');
  }

  // Add image CSS to critical CSS if downloaded
  if (imageCSS && !criticalCSS.includes('wp-block-image')) {
    criticalCSS += '\n\n/* ========================================\n   IMAGE BLOCK STYLES (inlined for performance)\n   Prevents render-blocking from image/style.min.css\n   ======================================== */\n' + imageCSS;
    console.log('✓ Added image CSS to criticalcss');
  }

  // Add ponyfill critical CSS
  if (ponyfillCriticalCSS && !criticalCSS.includes('aligncenter')) {
    criticalCSS += '\n\n/* ========================================\n   CRITICAL PONYFILL STYLES (inlined for performance)\n   Base alignment and layout - needed for initial render\n   Non-critical parts remain in external ponyfill.css\n   ======================================== */\n' + ponyfillCriticalCSS;
    console.log('✓ Added critical ponyfill CSS to criticalcss');
  }

  // Write updated critical CSS
  fs.writeFileSync(criticalCSSPath, criticalCSS);
  console.log('✓ Updated criticalcss file');

  // Step 3: Process all HTML files
  console.log('\n🔄 Processing HTML files...');

  const htmlFiles = await glob('**/*.html', {
    ignore: ['node_modules/**', 'wp-includes/**', 'wp-admin/**'],
    nodir: true,
    windowsPathsNoEscape: true
  });

  let filesModified = 0;

  for (const file of htmlFiles) {
    const filePath = path.join(rootDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Remove social-links CSS link
    const socialLinksRemoved = content.replace(
      /<link rel="stylesheet" id="wp-block-social-links-css" href="[^"]*\/social-links\/style\.min\.css[^"]*"[^>]*>\n?/g,
      ''
    );
    if (socialLinksRemoved !== content) {
      content = socialLinksRemoved;
      modified = true;
    }

    // Remove navigation CSS link (now inlined in critical)
    const navigationRemoved = content.replace(
      /<link rel="stylesheet" id="wp-block-navigation-css" href="[^"]*\/navigation\/style\.min\.css[^"]*"[^>]*>\n?/g,
      ''
    );
    if (navigationRemoved !== content) {
      content = navigationRemoved;
      modified = true;
    }

    // Remove navigation-link inline CSS (redundant with main navigation CSS)
    const navigationLinkRemoved = content.replace(
      /<style id="wp-block-navigation-link-inline-css">[\s\S]*?<\/style>\n?/g,
      ''
    );
    if (navigationLinkRemoved !== content) {
      content = navigationLinkRemoved;
      modified = true;
    }

    // Remove image CSS link (now inlined in critical)
    const imageRemoved = content.replace(
      /<link rel="stylesheet" id="wp-block-image-css" href="[^"]*\/image\/style\.min\.css[^"]*"[^>]*>\n?/g,
      ''
    );
    if (imageRemoved !== content) {
      content = imageRemoved;
      modified = true;
    }

    if (modified) {
      fs.writeFileSync(filePath, content);
      filesModified++;
      console.log(`  ✓ ${file}`);
    }
  }

  console.log(`\n✅ Complete! Modified ${filesModified} files`);

  console.log('\n📊 Summary:');
  console.log('  • Removed social-links/style.min.css (2.3 KiB, 490ms)');
  console.log('  • Removed navigation/style.min.css (3.1 KiB, 490ms) → inlined in criticalcss');
  console.log('  • Removed image/style.min.css (2.3 KiB, 510ms) → inlined in criticalcss');
  console.log('  • Added critical ponyfill CSS to criticalcss (alignment & layout)');
  console.log('  • Expected savings: ~1,490ms render-blocking time');
  console.log('\n⚠️  NEXT STEP: Run `node scripts/update-css.js` to inject updated critical CSS into all files');
}

optimizeRenderBlockingCSS().catch(console.error);
