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

// Size multiplier - adjust this if PageSpeed complains images are too large
// 1.0 = use declared width as-is
// 0.5 = assume images display at 50% of declared width
// 0.35 = assume images display at 35% of declared width (very conservative)
// For most WordPress themes with constrained content width, 0.35-0.4 is realistic
const SIZE_MULTIPLIER = 0.35; // Very conservative for content-constrained layouts

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
 * Convert absolute path to root-relative path
 */
function makeRelativePath(htmlFilePath, imagePath) {
  // Extract the path starting from wp-content
  const normalizedPath = imagePath.replace(/\\/g, '/');
  const wpContentIndex = normalizedPath.indexOf('wp-content/');

  if (wpContentIndex !== -1) {
    // Return root-relative path: /wp-content/...
    return '/' + normalizedPath.substring(wpContentIndex);
  }

  // Fallback to old relative path behavior if wp-content not found
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

  // Handle relative paths (./path or ../path or ../../path)
  // Remove any leading ./ or ../ segments to get to wp-content/uploads
  imagePath = imagePath.replace(/^(\.\.\/)+/, '').replace(/^\.\//, '');

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

  // Process <link rel="preload"> tags for images
  const preloadRegex = /<link\s+[^>]*rel=["']preload["'][^>]*as=["']image["'][^>]*>/gi;
  const preloadMatches = content.match(preloadRegex) || [];

  for (const preloadTag of preloadMatches) {
    const hrefMatch = preloadTag.match(/href=["']([^"']+)["']/i);
    if (!hrefMatch) continue;

    const originalHref = hrefMatch[1];

    // Skip if not a WordPress upload
    if (!originalHref.includes('wp-content/uploads')) continue;

    // Find the image in our map
    const imageKey = findImageKey(imageMap, originalHref);
    if (!imageKey) continue;

    const imageEntry = imageMap.get(imageKey);

    // For preload, use a smaller variant instead of the original
    // Choose the first variant larger than 400px, or the largest if all are smaller
    let preloadSrc;
    const variant400Plus = imageEntry.variants.find(v => v.width >= 400);
    if (variant400Plus) {
      preloadSrc = makeRelativePath(htmlFilePath, variant400Plus.path);
    } else if (imageEntry.variants.length > 0) {
      const largest = imageEntry.variants[imageEntry.variants.length - 1];
      preloadSrc = makeRelativePath(htmlFilePath, largest.path);
    } else if (imageEntry.original) {
      preloadSrc = makeRelativePath(htmlFilePath, imageEntry.original);
    } else {
      continue;
    }

    // Build new preload tag with relative path
    let newPreloadTag = preloadTag.replace(/href=["'][^"']+["']/i, `href="${preloadSrc}"`);

    if (newPreloadTag !== preloadTag) {
      content = content.replace(preloadTag, newPreloadTag);
      modified = true;
    }
  }

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

    // Try to find parent figure tag and check if image is in a column
    const imgIndex = content.indexOf(imgTag);
    const precedingContent = content.substring(Math.max(0, imgIndex - 500), imgIndex);
    const parentFigureMatch = precedingContent.match(/<figure[^>]*class="[^"]*\b(size-\w+)\b[^"]*"[^>]*>$/);
    const figureClass = parentFigureMatch ? parentFigureMatch[1] : null;

    // Check if image is inside wp-block-column (WordPress columns)
    const isInColumn = /<div[^>]*class="[^"]*wp-block-column[^"]*"[^>]*>(?:(?!<\/div>).)*$/s.test(precedingContent);

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

    // Add or update sizes attribute for better responsiveness
    // Strategy: Assume images are constrained by CSS to ~50% of viewport on desktop,
    // full width on mobile (common WordPress/responsive theme pattern)
    const widthMatch = newImgTag.match(/width=["']?(\d+)["']?/i);
    const declaredWidth = widthMatch ? parseInt(widthMatch[1]) : null;

    // Map WordPress size classes to ACTUAL displayed widths
    // Based on typical WordPress theme content constraints (~400-600px content width)
    const sizeClassActualWidths = {
      'size-thumbnail': 150,
      'size-medium': 300,
      'size-medium_large': 350, // Actually constrained by content width
      'size-large': 350,          // Actually constrained by content width
      'size-full': 400            // Actually constrained by content width
    };

    // Determine actual displayed width
    let actualDisplayWidth = null;

    // Priority 1: Use WordPress size class from parent figure or img tag (most reliable)
    if (figureClass && sizeClassActualWidths[figureClass]) {
      actualDisplayWidth = sizeClassActualWidths[figureClass];
    } else {
      for (const [className, width] of Object.entries(sizeClassActualWidths)) {
        if (newImgTag.includes(className)) {
          actualDisplayWidth = width;
          break;
        }
      }
    }

    // Priority 2: If no size class, use declared width * multiplier
    if (!actualDisplayWidth && declaredWidth) {
      actualDisplayWidth = Math.min(Math.round(declaredWidth * SIZE_MULTIPLIER), 400);
    }

    // Priority 3: Default conservative estimate
    if (!actualDisplayWidth) {
      actualDisplayWidth = 350;
    }

    // If image is in a column, it's displayed at roughly 1/2 or 1/3 of content width
    // Assume 2-column layout (most common), so divide by 2
    if (isInColumn) {
      actualDisplayWidth = Math.round(actualDisplayWidth * 0.45); // ~45% for 2-column with gap
    }

    // Generate sizes attribute using the actual display width
    // For columns, also account for responsive stacking on mobile
    let sizesAttr;
    if (isInColumn) {
      // Columns stack on mobile (100vw), side-by-side on desktop
      sizesAttr = `(max-width: 600px) 100vw, (max-width: 1000px) 50vw, ${actualDisplayWidth}px`;
    } else {
      // Regular single-column images
      sizesAttr = `(max-width: 600px) 100vw, ${actualDisplayWidth}px`;
    }

    // Replace or add sizes
    if (/sizes=/i.test(newImgTag)) {
      newImgTag = newImgTag.replace(/sizes=["'][^"']*["']/i, `sizes="${sizesAttr}"`);
    } else {
      newImgTag = newImgTag.replace(/>$/, ` sizes="${sizesAttr}">`);
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

  // Get the root directory (parent of scripts folder)
  const rootDir = path.join(__dirname, '..');

  // Change to root directory for glob
  process.chdir(rootDir);

  // Build image map
  const imageMap = await buildImageMap();

  // Find all HTML files
  console.log('\nFinding HTML files...');
  const htmlFiles = await glob('**/*.html', {
    ignore: ['node_modules/**', 'wp-includes/**', 'wp-admin/**', 'redirect.html'],
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