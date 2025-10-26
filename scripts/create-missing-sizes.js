#!/usr/bin/env node

/**
 * Create missing intermediate image sizes for better responsive images
 *
 * WordPress typically creates: 150, 240, 300, 768, 1024, 1536
 * But we need: 400, 450, 500 for better responsive coverage
 *
 * This script does TWO things:
 * 1. Generates missing intermediate sizes (400, 450, 500) as both WebP and JPEG
 * 2. Creates JPEG fallbacks for ALL existing WebP variants (for ancient browsers)
 */

const sharp = require('sharp');
const { glob } = require('glob');
const path = require('path');
const fs = require('fs');

// All standard WordPress sizes plus our custom intermediate sizes
const TARGET_WIDTHS = [150, 240, 300, 400, 450, 500, 768, 1024, 1536];

// Output formats: webp for modern browsers, jpeg for legacy fallback
const OUTPUT_FORMATS = [
  { ext: '.webp', options: { quality: 85, effort: 4 } },
  { ext: '.jpeg', options: { quality: 85, mozjpeg: true } }
];

async function createMissingVariants() {
  console.log('STEP 1: Creating all standard sizes (150, 240, 300, 400, 450, 500, 768, 1024, 1536)...\n');

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

        // Create both webp and jpeg versions
        for (const format of OUTPUT_FORMATS) {
          const variantFilename = `${baseName}-${targetWidth}x${targetHeight}${format.ext}`;
          const variantPath = path.join(dir, variantFilename);

          // Check if variant already exists
          if (fs.existsSync(variantPath)) {
            skipped++;
            continue;
          }

          // Create the variant
          const image = sharp(normalizedPath)
            .resize(targetWidth, targetHeight, {
              fit: 'inside',
              withoutEnlargement: true
            });

          // Apply format-specific options
          if (format.ext === '.webp') {
            await image.webp(format.options).toFile(variantPath);
          } else if (format.ext === '.jpeg') {
            await image.jpeg(format.options).toFile(variantPath);
          }

          console.log(`  ✓ Created: ${targetWidth}x${targetHeight}${format.ext}`);
          created++;
        }
      }

    } catch (err) {
      console.error(`  ✗ Error processing ${originalPath}:`, err.message);
    }
  }

  console.log(`\n✓ Step 1 Complete!`);
  console.log(`  Created: ${created} new variants`);
  console.log(`  Skipped: ${skipped} existing variants`);
}

async function createJpegFallbacks() {
  console.log('\n\nSTEP 2: Creating JPEG fallbacks for ALL existing WebP images...\n');

  // Find ALL WebP images (originals and variants)
  const webpImages = await glob('wp-content/uploads/**/*.webp', {
    nodir: true,
    windowsPathsNoEscape: true
  });

  console.log(`Found ${webpImages.length} WebP images\n`);

  let created = 0;
  let skipped = 0;

  for (const webpPath of webpImages) {
    const normalizedPath = webpPath.replace(/\\/g, '/');
    const dir = path.dirname(normalizedPath);
    const baseName = path.basename(normalizedPath, '.webp');

    // Create corresponding JPEG path
    const jpegPath = path.join(dir, `${baseName}.jpeg`);

    // Check if JPEG already exists
    if (fs.existsSync(jpegPath)) {
      skipped++;
      continue;
    }

    try {
      // Convert WebP to JPEG
      await sharp(normalizedPath)
        .jpeg({ quality: 85, mozjpeg: true })
        .toFile(jpegPath);

      console.log(`  ✓ Created: ${baseName}.jpeg`);
      created++;
    } catch (err) {
      console.error(`  ✗ Error converting ${normalizedPath}:`, err.message);
    }
  }

  console.log(`\n✓ Step 2 Complete!`);
  console.log(`  Created: ${created} JPEG fallbacks`);
  console.log(`  Skipped: ${skipped} existing JPEGs`);
}

async function main() {
  await createMissingVariants();
  await createJpegFallbacks();
  console.log('\n\n✅ ALL DONE! Your images are now fully optimized for all browsers.');
}

// Check if sharp is installed
try {
  require.resolve('sharp');
  main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
} catch (e) {
  console.error('Error: sharp module not found.');
  console.error('Please install it with: npm install sharp');
  process.exit(1);
}
