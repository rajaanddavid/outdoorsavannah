/**
 * Generate Affiliate Links Page HTML
 *
 * Creates WordPress block HTML for a page displaying all affiliate links
 * in a structured layout with thumbnails, buy buttons, and copy buttons
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
process.chdir(rootDir);

// Mapping for shortened slugs to display names
const slugDisplayNames = {
    'amzn': 'Amazon',
    'cat-shelf-guide': 'Cat Shelf Guide'
};

// Products to exclude
const excludedProducts = ['home', 'about'];

// Load amazonLinks.json
const amazonLinksPath = path.join(rootDir, 'amazonLinks.json');
if (!fs.existsSync(amazonLinksPath)) {
    console.error('❌ amazonLinks.json not found');
    process.exit(1);
}

const amazonLinks = JSON.parse(fs.readFileSync(amazonLinksPath, 'utf-8'));

// Helper: Get display name for product
function getDisplayName(productKey) {
    if (slugDisplayNames[productKey]) {
        return slugDisplayNames[productKey];
    }

    if (productKey.startsWith('product/')) {
        const slug = productKey.replace('product/', '');
        // Remove hyphens and capitalize first letter of each word
        return slug.split('-').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    }

    // Remove hyphens and capitalize for other keys
    return productKey.split('-').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
}

// Helper: Get anchor-friendly ID from product key
function getAnchorId(productKey) {
    if (productKey.startsWith('product/')) {
        return productKey.replace('product/', '');
    }
    return productKey;
}

// Helper: Extract product name from Amazon deeplink
function extractProductNameFromDeeplink(deeplinkUrl) {
    if (!deeplinkUrl) return null;

    const startIdx = deeplinkUrl.indexOf('amazon.com/') + 11;
    const endIdx = deeplinkUrl.indexOf('/dp/', startIdx);

    if (startIdx > 10 && endIdx > startIdx) {
        const productName = deeplinkUrl.substring(startIdx, endIdx);
        if (productName) {
            // Convert URL slug to readable name
            return productName
                .split('-')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(' ');
        }
    }

    return null;
}

// Helper: Get display name for variant
function getVariantDisplayName(variantKey, productKey = null, productLinks = null) {
    // For cat-shelf-guide extralinks, infer name from deeplink
    if (productKey === 'cat-shelf-guide' && variantKey.startsWith('extralink') && productLinks) {
        const deeplinkKey = variantKey + '_deeplink_ios';
        const deeplinkUrl = productLinks[deeplinkKey];
        const inferredName = extractProductNameFromDeeplink(deeplinkUrl);
        if (inferredName) return inferredName;
    }

    // Capitalize first letter of each word
    return variantKey
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

// Helper: Get unique variants for cat-shelf-guide (deduplicate based on deeplink URL)
function getUniqueVariants(productKey, productLinks) {
    const allVariantKeys = Object.keys(productLinks).filter(
        k => !k.endsWith('_deeplink_ios') && !k.endsWith('_deeplink_android')
    );

    // For cat-shelf-guide, only include extralinks and deduplicate by deeplink URL, exclude YouTube
    if (productKey === 'cat-shelf-guide') {
        const extralinks = allVariantKeys.filter(k => k.startsWith('extralink'));
        const seenUrls = new Set();
        const uniqueVariants = [];

        for (const variantKey of extralinks) {
            const url = productLinks[variantKey];
            // Skip YouTube links
            if (url && url.includes('youtube.com')) {
                continue;
            }
            if (url && !seenUrls.has(url)) {
                seenUrls.add(url);
                uniqueVariants.push(variantKey);
            }
        }

        return uniqueVariants;
    }

    // For other products, filter out extralinks
    return allVariantKeys.filter(k => !k.startsWith('extralink'));
}

// Helper: Get og:image from product page
function getProductImage(productKey) {
    const defaultImage = 'https://www.outdoorsavannah.com/wp-content/uploads/2025/04/cropped-profile-pic-yt_1.1.2-scaled-2-300x300.webp';
    let indexPath;

    if (productKey === 'home') {
        indexPath = path.join(rootDir, 'index.html');
    } else if (productKey === 'cat-shelf-guide') {
        indexPath = path.join(rootDir, 'cat-shelf-guide', 'index.html');
    } else if (productKey.startsWith('product/')) {
        const slug = productKey.replace('product/', '');
        indexPath = path.join(rootDir, 'product', slug, 'index.html');
    } else {
        return defaultImage;
    }

    if (!fs.existsSync(indexPath)) {
        return defaultImage;
    }

    const html = fs.readFileSync(indexPath, 'utf-8');
    const imageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);

    return imageMatch ? imageMatch[1] : defaultImage;
}

// Helper: Generate button HTML for a single variant
function generateVariantButton(productKey, variantKey, isFirstVariant, productLinks) {
    const displayName = getDisplayName(productKey);
    const variantDisplayName = getVariantDisplayName(variantKey, productKey, productLinks);

    let affiliateUrl;
    let buttonText;

    if (productKey === 'amzn') {
        affiliateUrl = `https://www.outdoorsavannah.com/affiliate/amzn/${variantKey}`;
        buttonText = `${variantDisplayName} on Amazon`;
    } else if (productKey.startsWith('product/')) {
        const slug = productKey.replace('product/', '');
        affiliateUrl = `https://www.outdoorsavannah.com/affiliate/${slug}/${variantKey}`;
        buttonText = `${displayName} on ${variantDisplayName}`;
    } else if (productKey === 'cat-shelf-guide' && variantKey.startsWith('extralink')) {
        affiliateUrl = `https://www.outdoorsavannah.com/affiliate/cat-shelf-guide/${variantKey}`;
        buttonText = variantDisplayName; // Just the product name for extralinks
    } else {
        affiliateUrl = `https://www.outdoorsavannah.com/affiliate/${productKey}/${variantKey}`;
        buttonText = `${displayName} on ${variantDisplayName}`;
    }

    return `<div class="wp-block-buttons is-layout-flex wp-block-buttons-is-layout-flex" style="flex-wrap:nowrap;">
<div class="wp-block-button buy-button"><a class="wp-block-button__link wp-element-button" href="${affiliateUrl}" target="_blank" rel="noreferrer noopener nofollow">${buttonText}</a></div>



<div class="wp-block-button is-style-outline"><a class="wp-block-button__link wp-element-button copy-link-btn" data-url="${affiliateUrl}" style="font-size: 1.2em; padding: 0.5em 0.8em; min-width:auto;">📋</a></div>
</div>`;
}

// Generate HTML blocks
let htmlOutput = `<!-- wp:html -->
<script defer src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{"token": "bb4c39b3f83c48b8bb675aca3076fcfa"}'></script>
<!-- /wp:html -->

<!-- wp:heading -->
<h2 class="wp-block-heading">All Affiliate Links</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>Click any button to visit the affiliate link, or click "Copy" to copy the link to share.</p>
<!-- /wp:paragraph -->

`;

console.log('🔗 Generating affiliate links page HTML...\n');

// Sort product keys: put 'product/' ones first, then others
const sortedKeys = Object.keys(amazonLinks).sort((a, b) => {
    const aIsProduct = a.startsWith('product/');
    const bIsProduct = b.startsWith('product/');

    if (aIsProduct && !bIsProduct) return -1;
    if (!aIsProduct && bIsProduct) return 1;
    return a.localeCompare(b);
});

for (const productKey of sortedKeys) {
    // Skip excluded products
    if (excludedProducts.includes(productKey)) {
        console.log(`  ⊘ Skipping ${productKey} (excluded)`);
        continue;
    }

    const productLinks = amazonLinks[productKey];
    const variantKeys = getUniqueVariants(productKey, productLinks);

    if (variantKeys.length === 0) continue;

    const displayName = getDisplayName(productKey);
    const image = getProductImage(productKey);
    const anchorId = getAnchorId(productKey);

    console.log(`  ✓ ${displayName} (${variantKeys.length} variant${variantKeys.length > 1 ? 's' : ''})`);

    // Start media + text layout (image left, content right)
    htmlOutput += `<!-- wp:media-text {"mediaPosition":"left","mediaId":0,"mediaType":"image","mediaWidth":15,"verticalAlignment":"top"} -->
<div class="wp-block-media-text alignwide has-media-on-the-left is-stacked-on-mobile is-vertically-aligned-top" style="grid-template-columns:15% auto">
<figure class="wp-block-media-text__media" style="text-align:center;"><img src="${image}" alt="${displayName}" style="max-width:120px;"/></figure>
<div class="wp-block-media-text__content">
<!-- wp:heading {"level":3} -->
<h3 class="wp-block-heading" id="${anchorId}" style="margin-top:0;"><strong>${displayName}</strong></h3>
<!-- /wp:heading -->

`;

    // Add all variant buttons
    for (let i = 0; i < variantKeys.length; i++) {
        const variantKey = variantKeys[i];
        htmlOutput += generateVariantButton(productKey, variantKey, i === 0, productLinks);

        if (i < variantKeys.length - 1) {
            htmlOutput += '\n<!-- wp:spacer {"height":"10px"} -->\n<div style="height:10px" aria-hidden="true" class="wp-block-spacer"></div>\n<!-- /wp:spacer -->\n\n';
        }
    }

    htmlOutput += `</div>
</div>
<!-- /wp:media-text -->

<!-- wp:spacer {"height":"30px"} -->
<div style="height:30px" aria-hidden="true" class="wp-block-spacer"></div>
<!-- /wp:spacer -->

`;
}

// Add copy functionality script
htmlOutput += `<!-- wp:html -->
<script>
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.copy-link-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const url = this.getAttribute('data-url');

            navigator.clipboard.writeText(url).then(() => {
                const originalText = this.textContent;
                this.textContent = 'Copied!';
                this.style.backgroundColor = '#28a745';

                setTimeout(() => {
                    this.textContent = originalText;
                    this.style.backgroundColor = '';
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy:', err);
                alert('Failed to copy link');
            });
        });
    });
});
</script>
<!-- /wp:html -->
`;

// Write output
const outputPath = path.join(rootDir, 'affiliate-links-page.html');
fs.writeFileSync(outputPath, htmlOutput, 'utf-8');

console.log(`\n✅ Generated affiliate links page!`);
console.log(`📄 Output: ${outputPath}`);
console.log('\n📋 Instructions:');
console.log('  1. Copy the contents of affiliate-links-page.html');
console.log('  2. In WordPress, create a new page');
console.log('  3. Switch to "Code editor" mode (not visual editor)');
console.log('  4. Paste the HTML code');
console.log('  5. Save and publish');
