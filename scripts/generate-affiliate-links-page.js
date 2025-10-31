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
    'home': 'Home',
    'cat-shelf-guide': 'Cat Shelf Guide'
};

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
        return productKey.replace('product/', '');
    }

    return productKey;
}

// Helper: Get display name for variant
function getVariantDisplayName(variantKey) {
    // Capitalize first letter of each word
    return variantKey
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

// Helper: Get og:image from product page
function getProductImage(productKey) {
    let indexPath;

    if (productKey === 'home') {
        indexPath = path.join(rootDir, 'index.html');
    } else if (productKey === 'cat-shelf-guide') {
        indexPath = path.join(rootDir, 'cat-shelf-guide', 'index.html');
    } else if (productKey.startsWith('product/')) {
        const slug = productKey.replace('product/', '');
        indexPath = path.join(rootDir, 'product', slug, 'index.html');
    } else {
        return 'https://www.outdoorsavannah.com/default-og-image.webp';
    }

    if (!fs.existsSync(indexPath)) {
        return 'https://www.outdoorsavannah.com/default-og-image.webp';
    }

    const html = fs.readFileSync(indexPath, 'utf-8');
    const imageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);

    return imageMatch ? imageMatch[1] : 'https://www.outdoorsavannah.com/default-og-image.webp';
}

// Helper: Generate button HTML for a single variant
function generateVariantButton(productKey, variantKey, isFirstVariant) {
    const displayName = getDisplayName(productKey);
    const variantDisplayName = getVariantDisplayName(variantKey);

    let affiliateUrl;
    let buttonText;

    if (productKey === 'amzn') {
        affiliateUrl = `https://www.outdoorsavannah.com/affiliate/amzn/${variantKey}`;
        buttonText = `Buy ${variantDisplayName} on Amazon`;
    } else if (productKey.startsWith('product/')) {
        const slug = productKey.replace('product/', '');
        affiliateUrl = `https://www.outdoorsavannah.com/affiliate/${slug}/${variantKey}`;
        buttonText = `Buy ${displayName} on ${variantDisplayName}`;
    } else {
        affiliateUrl = `https://www.outdoorsavannah.com/affiliate/${productKey}/${variantKey}`;
        buttonText = `Buy ${displayName} on ${variantDisplayName}`;
    }

    return `<div class="wp-block-buttons is-layout-flex wp-block-buttons-is-layout-flex">
<div class="wp-block-button buy-button"><a class="wp-block-button__link wp-element-button" href="${affiliateUrl}" target="_blank" rel="noreferrer noopener nofollow">${buttonText}</a></div>



<div class="wp-block-button"><a class="wp-block-button__link wp-element-button copy-link-btn" data-url="${affiliateUrl}">Copy</a></div>
</div>`;
}

// Generate HTML blocks
let htmlOutput = `<!-- wp:heading -->
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
    const productLinks = amazonLinks[productKey];
    const variantKeys = Object.keys(productLinks).filter(
        k => !k.endsWith('_deeplink_ios') && !k.endsWith('_deeplink_android')
    );

    if (variantKeys.length === 0) continue;

    const displayName = getDisplayName(productKey);
    const image = getProductImage(productKey);
    const rowspan = variantKeys.length;

    console.log(`  ✓ ${displayName} (${variantKeys.length} variant${variantKeys.length > 1 ? 's' : ''})`);

    // Start columns wrapper
    htmlOutput += `<!-- wp:columns -->
<div class="wp-block-columns is-layout-flex wp-container-core-columns-is-layout-1 wp-block-columns-is-layout-flex">
`;

    // Left column: Name + Image
    htmlOutput += `<!-- wp:column {"width":"33.33%"} -->
<div class="wp-block-column is-layout-flow wp-block-column-is-layout-flow" style="flex-basis:33.33%">
<!-- wp:heading {"level":3} -->
<h3 class="wp-block-heading"><strong>${displayName}</strong></h3>
<!-- /wp:heading -->

<!-- wp:image -->
<figure class="wp-block-image"><img src="${image}" alt="${displayName}"/></figure>
<!-- /wp:image -->
</div>
<!-- /wp:column -->

`;

    // Right column: Buttons for all variants
    htmlOutput += `<!-- wp:column {"width":"66.66%"} -->
<div class="wp-block-column is-layout-flow wp-block-column-is-layout-flow" style="flex-basis:66.66%">
`;

    for (let i = 0; i < variantKeys.length; i++) {
        const variantKey = variantKeys[i];
        htmlOutput += generateVariantButton(productKey, variantKey, i === 0);

        if (i < variantKeys.length - 1) {
            htmlOutput += '\n<!-- wp:spacer {"height":"10px"} -->\n<div style="height:10px" aria-hidden="true" class="wp-block-spacer"></div>\n<!-- /wp:spacer -->\n\n';
        }
    }

    htmlOutput += `</div>
<!-- /wp:column -->
</div>
<!-- /wp:columns -->

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
