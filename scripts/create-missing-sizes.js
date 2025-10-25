#!/usr/bin/env node

/**
 * Create missing intermediate image sizes for better responsive images
 *
 * WordPress typically creates: 150, 240, 300, 768, 1024, 1536
 * But we need: 400, 450, 500 for better responsive coverage
 */

const sharp = require('sharp');
const { glob } = require('glob');
const path = require('path');
const fs = require('fs');

// Target widths to create (if they don't exist)
const TARGET_WIDTHS = [400, 450, 500];

async function createMissingVariants() {
  console.log('Finding original images...\n');

  // Find all original images (without dimensions in filename)
  const allImages = await glob('wp-content/uploads/**/*.{webp,jpg,jpeg,png}', {
    nodir: true,
    windowsPathsNoEscape: true
  });

  // Filter to only originals (no dimensions in filename)
  const originals = allImages.filter(img => {
    const filename = path.basename(img);
    return !/-\d+x\d+\.(webp|jpg|jpeg|png)$/i.test(filename);
  });

  console.log(`Found ${originals.length} original images\n`);

  let created = 0;
  let skipped = 0;

  for (const originalPath of originals) {
    const normalizedPath = originalPath.replace(/\\/g, '/');
    const dir = path.dirname(normalizedPath);
    const ext = path.extname(normalizedPath);
    const baseName = path.basename(normalizedPath, ext);

    try {
      // Get original image metadata
      const metadata = await sharp(normalizedPath).metadata();
      const originalWidth = metadata.width;

      console.log(`Processing: ${baseName}${ext} (${originalWidth}x${metadata.height})`);

      for (const targetWidth of TARGET_WIDTHS) {
        // Skip if target is larger than original
        if (targetWidth >= originalWidth) {
          continue;
        }

        // Calculate proportional height
        const targetHeight = Math.round((targetWidth / originalWidth) * metadata.height);
        const variantFilename = `${baseName}-${targetWidth}x${targetHeight}${ext}`;
        const variantPath = path.join(dir, variantFilename);

        // Check if variant already exists
        if (fs.existsSync(variantPath)) {
          skipped++;
          continue;
        }

        // Create the variant
        await sharp(normalizedPath)
          .resize(targetWidth, targetHeight, {
            fit: 'inside',
            withoutEnlargement: true
          })
          .toFile(variantPath);

        console.log(`  ✓ Created: ${targetWidth}x${targetHeight}`);
        created++;
      }

    } catch (err) {
      console.error(`  ✗ Error processing ${originalPath}:`, err.message);
    }
  }

  console.log(`\n✓ Complete!`);
  console.log(`  Created: ${created} new variants`);
  console.log(`  Skipped: ${skipped} existing variants`);
}

// Check if sharp is installed
try {
  require.resolve('sharp');
  createMissingVariants().catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
} catch (e) {
  console.error('Error: sharp module not found.');
  console.error('Please install it with: npm install sharp');
  process.exit(1);
}
