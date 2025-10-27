#!/usr/bin/env node

/**
 * Master deployment script for static site
 * Runs all optimization scripts in the correct order
 *
 * USAGE: node scripts/deploy-static-site.js
 *
 * Run this after exporting static site from WordPress and copying to repository
 */

const { execSync } = require('child_process');
const path = require('path');

const rootDir = path.join(__dirname, '..');
process.chdir(rootDir);

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function runScript(scriptName, description) {
  log(`\n${'='.repeat(60)}`, 'cyan');
  log(`${description}`, 'bright');
  log(`Running: node scripts/${scriptName}`, 'cyan');
  log('='.repeat(60), 'cyan');

  try {
    execSync(`node scripts/${scriptName}`, {
      stdio: 'inherit',
      cwd: rootDir
    });
    log(`✓ ${description} - COMPLETE\n`, 'green');
  } catch (error) {
    log(`\n✗ ERROR in ${scriptName}`, 'red');
    log(`Script failed: ${description}`, 'red');
    log(`\nDeployment stopped. Please fix the error and try again.`, 'yellow');
    process.exit(1);
  }
}

async function deploy() {
  log('\n🚀 STATIC SITE DEPLOYMENT PIPELINE', 'bright');
  log('================================\n', 'bright');

  const startTime = Date.now();

  // Pre-step: Handle 404 page renaming and moving
  log(`\n${'='.repeat(60)}`, 'cyan');
  log('Pre-step: Setting up 404 page', 'bright');
  log('='.repeat(60), 'cyan');

  try {
    const fs = require('fs');
    const fourOhFourPath = path.join(rootDir, 'fourohfour', 'index.html');
    const fourOhFourNewPath = path.join(rootDir, 'fourohfour', '404.html');
    const finalPath = path.join(rootDir, '404.html');

    // Rename fourohfour/index.html to fourohfour/404.html
    if (fs.existsSync(fourOhFourPath)) {
      fs.renameSync(fourOhFourPath, fourOhFourNewPath);
      log('  ✓ Renamed fourohfour/index.html to fourohfour/404.html', 'green');
    }

    // Move fourohfour/404.html to root /404.html
    if (fs.existsSync(fourOhFourNewPath)) {
      fs.renameSync(fourOhFourNewPath, finalPath);
      log('  ✓ Moved fourohfour/404.html to /404.html', 'green');
    }

    // Remove fourohfour entry from page-sitemap.xml
    const sitemapPath = path.join(rootDir, 'page-sitemap.xml');
    if (fs.existsSync(sitemapPath)) {
      let sitemapContent = fs.readFileSync(sitemapPath, 'utf8');

      // Remove the fourohfour URL entry (entire <url> block)
      sitemapContent = sitemapContent.replace(
        /\s*<url>\s*<loc><!\[CDATA\[https:\/\/www\.outdoorsavannah\.com\/fourohfour\/\]\]><\/loc>[\s\S]*?<\/url>/g,
        ''
      );

      fs.writeFileSync(sitemapPath, sitemapContent, 'utf8');
      log('  ✓ Removed fourohfour from page-sitemap.xml', 'green');
    }

    log('✓ 404 page setup - COMPLETE\n', 'green');
  } catch (error) {
    log(`\n✗ ERROR setting up 404 page`, 'red');
    log(`${error.message}`, 'red');
    log(`\nContinuing with deployment...`, 'yellow');
  }

  // Step 1: Generate affiliate link pages
  runScript(
    'generate-affiliate-links.js',
    'Step 1/7: Generating affiliate link pages'
  );

  // Step 2: Create missing image sizes
  runScript(
    'create-missing-sizes.js',
    'Step 2/7: Creating missing image sizes for responsive images'
  );

  // Step 3: Make images responsive
  runScript(
    'make-images-responsive.js',
    'Step 3/7: Converting images to responsive picture elements'
  );

  // Step 4: Remove render-blocking CSS
  runScript(
    'remove-render-blocking-css.js',
    'Step 4/7: Removing render-blocking CSS and inlining critical styles'
  );

  // Step 5: Update critical CSS in all files
  runScript(
    'update-css.js',
    'Step 5/7: Injecting updated critical CSS into all HTML files'
  );

  // Step 6: Defer ponyfill CSS
  runScript(
    'defer-ponyfill.js',
    'Step 6/7: Deferring ponyfill.css for non-blocking load'
  );

  // Step 7: Insert headers (Google Analytics, etc.)
  runScript(
    'insertheaders.js',
    'Step 7/7: Inserting headers and analytics into all pages'
  );

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  log('\n' + '='.repeat(60), 'green');
  log('🎉 DEPLOYMENT COMPLETE!', 'green');
  log('='.repeat(60), 'green');
  log(`\nTotal time: ${duration}s`, 'cyan');
  log('\n📋 Summary:', 'bright');
  log('  ✓ Affiliate pages generated');
  log('  ✓ Image sizes created');
  log('  ✓ Images made responsive');
  log('  ✓ Render-blocking CSS removed');
  log('  ✓ Critical CSS injected');
  log('  ✓ Ponyfill CSS deferred');
  log('  ✓ Headers inserted');
  log('\n🚢 Your static site is ready to deploy!\n', 'green');
}

// Run deployment
deploy().catch((error) => {
  log('\n✗ Deployment failed with error:', 'red');
  console.error(error);
  process.exit(1);
});
