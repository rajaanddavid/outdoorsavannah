#!/usr/bin/env node

/**
 * WordPress Static Site Image Responsiveness Script
 *
 * This script:
 * 1. Scans wp-content/uploads for all images and their variants
 * 2. Processes all HTML files in the site
 * 3. Converts absolute image URLs to relative paths
 * 4. Adds responsive srcset and sizes attributes
 * 5. Uses the original (no dimensions) image as the fallback
 */

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

// Configuration
const UPLOADS_DIR = 'wp-content/uploads';
const SITE_DOMAIN = 'https://www.outdoorsavannah.com';

/**
 * Parse WordPress image filename to extract base name and dimensions
 * Examples:
 *   "image-300x200.webp" -> { base: "image", width: 300, height: 200, ext: "webp" }
 *   "image.webp" -> { base: "image", width: null, height: null, ext: "webp" }
 */
function parseImageFilename(filename) {
  const match = filename.match(/^(.+?)-(\d+)x(\d+)\.([^.]+)$/);

  if (match) {
    return {
      base: match[1],
      width: parseInt(match[2]),
      height: parseInt(match[3]),
      ext: match[4],
      isVariant: true
    };
  }

  // Original image (no dimensions)
  const baseMatch = filename.match(/^(.+)\.([^.]+)$/);
  if (baseMatch) {
    return {
      base: baseMatch[1],
      width: null,
      height: null,
      ext: baseMatch[2],
      isVariant: false
    };
  }

  return null;
}

/**
 * Build a map of all images and their variants
 * Structure: {
 *   "2025/04/image-name.webp": {
 *     original: "wp-content/uploads/2025/04/image-name.webp",
 *     variants: [
 *       { path: "wp-content/uploads/2025/04/image-name-300x200.webp", width: 300, height: 200 },
 *       { path: "wp-content/uploads/2025/04/image-name-768x512.webp", width: 768, height: 512 },
 *       ...
 *     ]
 *   }
 * }
 */
async function buildImageMap() {
  console.log('Scanning WordPress uploads directory...');

  const imageExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
  const pattern = `${UPLOADS_DIR}/**/*.{${imageExtensions.join(',')}}`;

  const files = await glob(pattern, { nodir: true, windowsPathsNoEscape: true });
  console.log(`Found ${files.length} image files`);

  const imageMap = new Map();

  for (const filePath of files) {
    const normalizedPath = filePath.replace(/\\/g, '/');
    const filename = path.basename(normalizedPath);
    const parsed = parseImageFilename(filename);

    if (!parsed) continue;

    const dir = path.dirname(normalizedPath).replace(/\\/g, '/');
    const relativeDir = dir.replace(`${UPLOADS_DIR}/`, '');
    const key = `${relativeDir}/${parsed.base}.${parsed.ext}`;

    if (!imageMap.has(key)) {
      imageMap.set(key, {
        original: null,
        variants: []
      });
    }

    const entry = imageMap.get(key);

    if (!parsed.isVariant) {
      entry.original = normalizedPath;
    } else {
      entry.variants.push({
        path: normalizedPath,
        width: parsed.width,
        height: parsed.height
      });
    }
  }

  // Sort variants by width
  for (const entry of imageMap.values()) {
    entry.variants.sort((a, b) => a.width - b.width);
  }

  console.log(`Mapped ${imageMap.size} unique images with variants`);
  return imageMap;
}

/**
 * Convert absolute URL to relative path from HTML file location
 */
function makeRelativePath(htmlFilePath, imagePath) {
  const htmlDir = path.dirname(htmlFilePath);
  const relativePath = path.relative(htmlDir, imagePath).replace(/\\/g, '/');

  // Ensure path starts with ./ or ../
  if (!relativePath.startsWith('.')) {
    return './' + relativePath;
  }
  return relativePath;
}

/**
 * Extract image path from URL (handle both absolute and relative)
 */
function extractImagePath(url) {
  // Remove domain if present
  let imagePath = url.replace(SITE_DOMAIN, '');

  // Remove leading slash
  if (imagePath.startsWith('/')) {
    imagePath = imagePath.substring(1);
  }

  return imagePath;
}

/**
 * Find the image key in the map for a given URL
 */
function findImageKey(imageMap, url) {
  const imagePath = extractImagePath(url);
  const filename = path.basename(imagePath);
  const parsed = parseImageFilename(filename);

  if (!parsed) return null;

  const dir = path.dirname(imagePath).replace(/\\/g, '/');
  const relativeDir = dir.replace(`${UPLOADS_DIR}/`, '');
  const key = `${relativeDir}/${parsed.base}.${parsed.ext}`;

  if (imageMap.has(key)) {
    return key;
  }

  return null;
}

/**
 * Generate srcset attribute for an image
 */
function generateSrcset(htmlFilePath, imageEntry) {
  const srcsetParts = [];

  // Add all variants
  for (const variant of imageEntry.variants) {
    const relativePath = makeRelativePath(htmlFilePath, variant.path);
    srcsetParts.push(`${relativePath} ${variant.width}w`);
  }

  // Add original if it exists
  if (imageEntry.original) {
    const relativePath = makeRelativePath(htmlFilePath, imageEntry.original);
    // For original, we don't know the exact width, so put it last without width descriptor
    // or we can just use it as the largest size
    srcsetParts.push(relativePath);
  }

  return srcsetParts.join(', ');
}

/**
 * Process a single HTML file
 */
async function processHtmlFile(htmlFilePath, imageMap) {
  let content = fs.readFileSync(htmlFilePath, 'utf8');
  let modified = false;

  // Match <img> tags (handles multiline)
  const imgRegex = /<img\s+[^>]*>/gi;
  const matches = content.match(imgRegex) || [];

  for (const imgTag of matches) {
    // Extract src attribute
    const srcMatch = imgTag.match(/src=["']([^"']+)["']/i);
    if (!srcMatch) continue;

    const originalSrc = srcMatch[1];

    // Skip if not a WordPress upload
    if (!originalSrc.includes('wp-content/uploads')) continue;

    // Find the image in our map
    const imageKey = findImageKey(imageMap, originalSrc);
    if (!imageKey) {
      console.log(`  ⚠ Image not found in map: ${originalSrc}`);
      continue;
    }

    const imageEntry = imageMap.get(imageKey);

    // Determine the best src (prefer original, fallback to largest variant)
    let newSrc;
    if (imageEntry.original) {
      newSrc = makeRelativePath(htmlFilePath, imageEntry.original);
    } else if (imageEntry.variants.length > 0) {
      const largest = imageEntry.variants[imageEntry.variants.length - 1];
      newSrc = makeRelativePath(htmlFilePath, largest.path);
    } else {
      continue;
    }

    // Generate srcset
    const srcset = generateSrcset(htmlFilePath, imageEntry);

    // Build new img tag
    let newImgTag = imgTag;

    // Replace src with relative path
    newImgTag = newImgTag.replace(/src=["'][^"']+["']/i, `src="${newSrc}"`);

    // Replace or add srcset
    if (/srcset=/i.test(newImgTag)) {
      newImgTag = newImgTag.replace(/srcset=["'][^"']*["']/i, `srcset="${srcset}"`);
    } else {
      // Add srcset before the closing >
      newImgTag = newImgTag.replace(/>$/, ` srcset="${srcset}">`);
    }

    // Add or update sizes attribute if not present
    // Default to responsive: (max-width: [width]px) 100vw, [width]px
    if (!/sizes=/i.test(newImgTag)) {
      // Extract width from existing attributes or use a sensible default
      const widthMatch = newImgTag.match(/width=["']?(\d+)["']?/i);
      if (widthMatch) {
        const width = widthMatch[1];
        newImgTag = newImgTag.replace(/>$/, ` sizes="(max-width: ${width}px) 100vw, ${width}px">`);
      } else {
        // Generic responsive sizes
        newImgTag = newImgTag.replace(/>$/, ` sizes="(max-width: 768px) 100vw, 768px">`);
      }
    }

    // Replace in content
    if (newImgTag !== imgTag) {
      content = content.replace(imgTag, newImgTag);
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(htmlFilePath, content, 'utf8');
    console.log(`  ✓ Updated: ${htmlFilePath}`);
    return true;
  }

  return false;
}

/**
 * Main execution
 */
async function main() {
  console.log('WordPress Static Site - Make Images Responsive');
  console.log('================================================\n');

  // Build image map
  const imageMap = await buildImageMap();

  // Find all HTML files
  console.log('\nFinding HTML files...');
  const htmlFiles = await glob('**/*.html', {
    ignore: ['node_modules/**', 'wp-includes/**', 'wp-admin/**'],
    nodir: true,
    windowsPathsNoEscape: true
  });

  console.log(`Found ${htmlFiles.length} HTML files\n`);

  // Process each HTML file
  console.log('Processing HTML files...');
  let updatedCount = 0;

  for (const htmlFile of htmlFiles) {
    const updated = await processHtmlFile(htmlFile, imageMap);
    if (updated) updatedCount++;
  }

  console.log(`\n✓ Complete! Updated ${updatedCount} of ${htmlFiles.length} HTML files`);
}

// Run if called directly
if (require.main === module) {
  main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
}

module.exports = { buildImageMap, processHtmlFile };