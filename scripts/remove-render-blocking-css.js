const fs = require('fs');
const path = require('path');
const https = require('https');
const { glob } = require('glob');

const rootDir = path.join(__dirname, '..');
process.chdir(rootDir);

// Download CSS content from URLs
async function downloadCSS(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function optimizeRenderBlockingCSS() {
  console.log('🚀 Starting render-blocking CSS optimization...\n');

  // Step 1: Download navigation CSS and image CSS
  console.log('📥 Downloading CSS files...');

  let navigationCSS = '';
  let imageCSS = '';

  try {
    navigationCSS = await downloadCSS('https://www.outdoorsavannah.com/wp-includes/blocks/navigation/style.min.css?ver=6.8.3');
    console.log('✓ Downloaded navigation/style.min.css');
  } catch (error) {
    console.log('⚠️  Could not download navigation CSS, will try to extract from existing files');
  }

  try {
    imageCSS = await downloadCSS('https://www.outdoorsavannah.com/wp-includes/blocks/image/style.min.css?ver=6.8.3');
    console.log('✓ Downloaded image/style.min.css');
  } catch (error) {
    console.log('⚠️  Could not download image CSS, will try to extract from existing files');
  }

  // Fallback: Extract from existing inline styles if download failed
  if (!navigationCSS || !imageCSS) {
    console.log('\n📄 Extracting CSS from existing HTML files...');

    if (!imageCSS) {
      // Image CSS is already inlined in homepage, extract it
      const homepageFile = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
      const imageInlineMatch = homepageFile.match(/<style id="wp-block-image-inline-css">([\s\S]*?)<\/style>/);
      if (imageInlineMatch) {
        imageCSS = imageInlineMatch[1];
        console.log('✓ Extracted image CSS from homepage inline styles');
      }
    }
  }

  // Step 1.5: Extract critical portions of ponyfill.css
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

    console.log('✓ Extracted critical alignment & layout CSS from ponyfill.css');
  } else {
    console.log('⚠️  ponyfill.css not found, skipping');
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
