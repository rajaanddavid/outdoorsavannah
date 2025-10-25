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

    // Normalize key to always use .webp extension so JPEG and WebP variants map to same image
    const normalizedExt = 'webp';
    const key = `${relativeDir}/${parsed.base}.${normalizedExt}`;

    if (!imageMap.has(key)) {
      imageMap.set(key, {
        original: null,
        variants: []
      });
    }

    const entry = imageMap.get(key);

    if (!parsed.isVariant) {
      // Prefer webp original over jpeg
      if (!entry.original || parsed.ext === 'webp') {
        entry.original = normalizedPath;
      }
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
 * Generate srcset attribute for an image (used for legacy code path)
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
    srcsetParts.push(relativePath);
  }

  return srcsetParts.join(', ');
}

/**
 * Generate <picture> element with <source> tags for responsive images
 */
function generatePictureElement(htmlFilePath, imageEntry, imgAttributes) {
  // Group variants by format (webp vs jpeg)
  const webpVariants = imageEntry.variants.filter(v => v.path.endsWith('.webp'));
  const jpegVariants = imageEntry.variants.filter(v => v.path.match(/\.(jpe?g)$/i));

  // Breakpoints with overlapping ranges to ensure proper coverage
  const breakpoints = [
    { name: 'mobile', mediaQuery: '(max-width: 480px)', minWidth: 150, maxWidth: 500 },
    { name: 'tablet', mediaQuery: '(max-width: 1000px)', minWidth: 450, maxWidth: 1024 },
    { name: 'desktop', mediaQuery: '(min-width: 1001px)', minWidth: 768, maxWidth: Infinity }
  ];

  let pictureHtml = '  <picture>\n';

  // Generate <source> tags for each breakpoint
  for (const breakpoint of breakpoints) {
    // WebP source - filter by size range
    const webpForBreakpoint = webpVariants.filter(v =>
      v.width >= breakpoint.minWidth && v.width <= breakpoint.maxWidth
    );

    if (webpForBreakpoint.length > 0) {
      const srcsetParts = webpForBreakpoint
        .map(v => `${makeRelativePath(htmlFilePath, v.path)} ${v.width}w`)
        .join(',\n        ');

      const description = breakpoint.name === 'mobile' ? 'up to 480px'
        : breakpoint.name === 'tablet' ? 'up to 1000px'
        : 'larger screens';

      pictureHtml += `    <!-- ${breakpoint.name.charAt(0).toUpperCase() + breakpoint.name.slice(1)}: ${description} -->\n`;
      pictureHtml += `    <source\n`;
      pictureHtml += `      media="${breakpoint.mediaQuery}"\n`;
      pictureHtml += `      srcset="\n        ${srcsetParts}\n      "\n`;
      pictureHtml += `      type="image/webp">\n\n`;
    }
  }

  // JPEG fallback (for legacy browsers) - provide full responsive support
  if (jpegVariants.length > 0) {
    const jpegSrcset = jpegVariants
      .map(v => `${makeRelativePath(htmlFilePath, v.path)} ${v.width}w`)
      .join(',\n        ');

    pictureHtml += `    <!-- Legacy browser fallback (JPEG) -->\n`;
    pictureHtml += `    <source\n`;
    pictureHtml += `      srcset="\n        ${jpegSrcset}\n      "\n`;
    pictureHtml += `      type="image/jpeg">\n\n`;
  }

  // Fallback <img> tag
  const fallbackSrc = imageEntry.original ||
                      webpVariants[Math.floor(webpVariants.length / 2)]?.path ||
                      imageEntry.variants[0]?.path;

  pictureHtml += `    <img ${imgAttributes} src="${makeRelativePath(htmlFilePath, fallbackSrc)}">\n`;
  pictureHtml += `  </picture>`;

  return pictureHtml;
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
    const precedingContent = content.substring(Math.max(0, imgIndex - 1000), imgIndex);
    const parentFigureMatch = precedingContent.match(/<figure[^>]*class="[^"]*\b(size-\w+)\b[^"]*"[^>]*>$/);
    const figureClass = parentFigureMatch ? parentFigureMatch[1] : null;

    // Skip images in excluded contexts (logos, social media icons, etc.)
    const excludedPatterns = [
      /site-branding.*?brand.*?has-logo-image/s,  // Site logo
      /mobile-site-branding.*?brand.*?has-logo-image/s,  // Mobile logo
      /footer-social-wrap/s,  // Footer social media icons
      /social-button.*?footer-social-item/s,  // Social media buttons
      /header-social/s,  // Header social media
      /custom-logo/  // WordPress custom logo class
    ];

    const shouldExclude = excludedPatterns.some(pattern => pattern.test(precedingContent));
    if (shouldExclude) {
      continue; // Skip logos and social media icons
    }

    // Check if image is inside wp-block-column (WordPress columns)
    const isInColumn = /<div[^>]*class="[^"]*wp-block-column[^"]*"[^>]*>(?:(?!<\/div>).)*$/s.test(precedingContent);

    // Find the image in our map
    const imageKey = findImageKey(imageMap, originalSrc);
    if (!imageKey) {
      console.log(`  ⚠ Image not found in map: ${originalSrc}`);
      continue;
    }

    const imageEntry = imageMap.get(imageKey);

    // Check if this image is already inside a <picture> element
    const alreadyInPicture = /<picture[^>]*>(?:[^<]|<(?!\/picture>))*$/s.test(precedingContent);
    if (alreadyInPicture) {
      continue; // Skip if already wrapped in <picture>
    }

    // Extract all img attributes (except src, srcset, sizes - we'll regenerate those)
    let imgAttributes = imgTag
      .replace(/<img\s+/i, '')
      .replace(/>/i, '')
      .replace(/\s*src=["'][^"']*["']/gi, '')
      .replace(/\s*srcset=["'][^"']*["']/gi, '')
      .replace(/\s*sizes=["'][^"']*["']/gi, '')
      .trim();

    // Generate <picture> element
    const pictureElement = generatePictureElement(htmlFilePath, imageEntry, imgAttributes);

    // Check if img is inside a <figure> - if so, replace just the img, not the figure
    const figureMatch = precedingContent.match(/<figure[^>]*>(?:(?!<img).)*$/s);

    let replacement;
    if (figureMatch) {
      // Just replace the <img> with <picture>
      replacement = pictureElement;
    } else {
      // Wrap in a figure
      const sizeClass = figureClass || 'size-large';
      replacement = `<figure class="wp-block-image aligncenter ${sizeClass}">\n${pictureElement}\n</figure>`;
    }

    // Replace the <img> tag with <picture> element
    content = content.replace(imgTag, replacement);
    modified = true;
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