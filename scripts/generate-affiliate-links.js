/**
 * Generate Affiliate Link Preview Pages
 *
 * Creates social media preview pages for:
 * - Homepage, cat-shelf-guide, and all product pages → /affiliate/
 * - Amazon affiliate links → /affiliate/amzn/
 *
 * Structure:
 * /affiliate/
 *   ├── home.html (homepage preview)
 *   ├── cat-shelf-guide.html
 *   ├── product.html
 *   ├── [product-name].html (one for each product)
 *   └── amzn/
 *       ├── store.html
 *       ├── outdoor-adventures.html
 *       ├── cat-wall.html
 *       └── oxyfresh.html
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
process.chdir(rootDir);

const productDir = path.join(rootDir, "product");
const catShelfGuideDir = path.join(rootDir, "cat-shelf-guide");
const previewDir = path.join(rootDir, "affiliate");
const amznDir = path.join(previewDir, "amzn");

// Create directories if they don't exist
if (!fs.existsSync(previewDir)) fs.mkdirSync(previewDir, { recursive: true });
if (!fs.existsSync(amznDir)) fs.mkdirSync(amznDir, { recursive: true });

const fbAppId = "1234567890";
const twitterSite = "@outdoorsavannah";
const twitterCreator = "@outdoorsavannah";
const profileImageUrl = "https://www.outdoorsavannah.com/wp-content/uploads/2025/04/cropped-profile-pic-yt_1.1.2-scaled-2-300x300.webp";

// --- Extract product title from Amazon deeplink URL ---
function extractProductTitle(deeplinkUrl, variantKey) {
    if (!deeplinkUrl) return null;

    const startIdx = deeplinkUrl.indexOf('amazon.com/') + 11;
    const endIdx = deeplinkUrl.indexOf('/dp/', startIdx);

    if (startIdx > 10 && endIdx > startIdx) {
        const productName = deeplinkUrl.substring(startIdx, endIdx);
        if (productName) {
            return productName
                .split('-')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(' ');
        }
    }

    // --- Fallback: format the variant key if no product name found ---
    if (variantKey) {
        return variantKey
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }

    return null;
}

// --- Simplified template that routes to redirect.html ---
const template = (meta, productKey) => {
    const pageTitle = (meta.title.includes("Raja and David®") || meta.title.includes("Amazon Affiliate Link"))
        ? meta.title
        : `${meta.title} - Raja and David®`;
    const ogImage = meta.image || "https://www.outdoorsavannah.com/default-og-image.webp";
    const ogDescription = meta.description || "";
    const ogUrl = meta.url || "";

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${pageTitle}</title>
<style>
    * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
    }

    body {
        width: 100%;
        height: 100vh;
        display: flex;
        justify-content: center;
        align-items: center;
        background: #f5f5f5;
    }

    .profile-circle {
        width: 90vw;
        max-width: 400px;
        aspect-ratio: 1;
        border-radius: 50%;
        overflow: hidden;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .profile-circle img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

        /* Dark mode adjustments */
    @media (prefers-color-scheme: dark) {
        /* Background and text colors for Kadence theme */
        body,
        .site,
        .site-content,
        .content-bg,
        article,
        .entry-content {
            background-color: #0d0d0d !important;
            color: #f0f0f0 !important;
        }

    /* CookieYes Banner - try multiple selectors */
    div[id*="cookie"],
    div[class*="cookie"],
    div[class*="cky"],
    .cky-consent-container,
    .cky-consent-bar,
    [data-cky-tag="detail"],
    [data-cky-tag="notice"] {
        background-color: #1a1a1a !important;
        color: #f0f0f0 !important;
    }

    /* CookieYes text */
    div[id*="cookie"] span,
    div[id*="cookie"] p,
    div[id*="cookie"] div,
    div[class*="cookie"] span,
    div[class*="cookie"] p,
    div[class*="cky"] span,
    div[class*="cky"] p {
        color: #f0f0f0 !important;
    }

    /* CookieYes buttons */
    div[id*="cookie"] button,
    div[class*="cookie"] button,
    div[class*="cky"] button,
    .cky-btn {
        border-color: #ffffff !important;
    }
</style>

<!-- Open Graph & Twitter meta -->
<meta property="og:type" content="website">
<meta property="og:title" content="${pageTitle}">
<meta property="og:image" content="${ogImage}">
<meta property="og:description" content="${ogDescription}">
<meta property="og:url" content="${ogUrl}">
<meta property="fb:app_id" content="${fbAppId}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${pageTitle}">
<meta name="twitter:description" content="${ogDescription}">
<meta name="twitter:image" content="${ogImage}">
<meta name="twitter:site" content="${twitterSite}">
<meta name="twitter:creator" content="${twitterCreator}">
<meta name="robots" content="noindex, nofollow">

<script>
document.addEventListener("DOMContentLoaded", async function() {
    const ua = navigator.userAgent;
    const _isIOS = /iPhone|iPad|iPod/i.test(ua);
    const _isAndroid = /Android/i.test(ua);
    const _isMobile = /Mobile|iPhone|iPad|iPod|Android|BlackBerry|IEMobile|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/i.test(ua);
    const _isAppBrowser = new RegExp(
      '((?:fban\\/fbios|fb_iab\\/fb4a)(?!.+fbav)|;fbav\\/([\\w.]+);|metaiab|instagram|barcelona|threads|linkedIn|twitter|tiktok|wechat|line)',
      'i'
    ).test(ua);
    const _isChromeAndroid =
      ua.includes('Chrome') &&
      ua.includes('Android') &&
      !ua.includes('Edg') &&
      !ua.includes('OPR') &&
      !ua.includes('Brave');

    // Return cached values
    function isMobile() { return _isMobile; }
    function isAndroid() { return _isAndroid; }
    function isIOS() { return _isIOS; }
    function isAppBrowser() { return _isAppBrowser; }
    function isChromeAndroid() { return _isChromeAndroid; }

    const url = new URL(window.location.href);
    const productKey = "${productKey}";

    let variant = url.searchParams.get('variant');
    if (!variant) {
        const hashMatch = url.hash.match(/[?&]variant=([^&]*)/);
        if (hashMatch) variant = hashMatch[1];
    }

    // --- Extract variant from filename for amzn preview pages ---
    if (productKey === "amzn" && !variant) {
        const filename = window.location.pathname.split('/').pop().replace('.html', '');
        if (filename !== 'index') {
            variant = filename;
        }
    }

    variant = variant || "";

    const skipRedirect = url.searchParams.get('skipredirect') === 'true';
    const hash = url.hash || "";

    if (skipRedirect) {
        return;
    }

    if (!variant) {
        let productPageUrl;
        if (productKey === "home") {
            productPageUrl = "/";
        } else if (productKey === "amzn") {
            return;
        } else if (productKey.startsWith("product/")) {
            productPageUrl = "/" + productKey + "/";
        } else {
            productPageUrl = "/" + productKey + "/";
        }
        window.location.replace(productPageUrl);
        return;
    }

    let amazonLinks = {};
    try {
        const res = await fetch('/amazonLinks.json');
        amazonLinks = await res.json();
    } catch (e) {
        console.error('Failed to load amazonLinks.json');
        window.location.replace('/');
        return;
    }

    const productLinks = amazonLinks[productKey];
    if (!productLinks) {
        console.error('Product not found in amazonLinks.json');
        window.location.replace('/');
        return;
    }

    // Build base query string safely
    const queryParams = [
        'product=' + encodeURIComponent(productKey),
        variant ? 'variant=' + encodeURIComponent(variant) : null
    ].filter(Boolean).join('&');

    // Encode hash safely; remove leading '#' if present
    const encodedHash = hash ? '%23' + encodeURIComponent(hash.replace(/^#/, '')) : '';

    const validKeys = Object.keys(productLinks).filter(
        k => !k.endsWith("_deeplink_ios") && !k.endsWith("_deeplink_android")
    );
    const targetKey = variant && validKeys.find(k => k.toLowerCase() === variant.toLowerCase())
        ? variant
        : validKeys[0];
    let targetLink = productLinks[targetKey] || '/';

    const baseRedirect = '/redirect?' + queryParams + encodedHash;

    if (!isMobile()) {
        window.location.replace(targetLink);
        return;
    }

    // Mobile redirects


    // If there are existing query params, append &skipDeeplink=true
    const skipParam = queryParams ? '&skipDeeplink=true' : 'skipDeeplink=true';

    if (isAndroid()) {
        if (isAppBrowser()) {
            // Android app browser → intent
            // Ensure queryParams and encodedHash are already URL-safe
            const androidRedirect = [
                'intent://www.outdoorsavannah.com/redirect?',
                queryParams,
                encodedHash,
                '#Intent;scheme=https;action=android.intent.action.VIEW;end'
            ].join('');
            window.location.href = androidRedirect;
            return;
        } else if (isChromeAndroid()) {
            const deeplink_android = productLinks[targetKey + '_deeplink_android'];
            const startTime = Date.now();
            let hasLeftPage = false;
            let userInteractedWithPrompt = false;

            const handleVisibilityChange = () => {
                if (document.hidden) hasLeftPage = true;
            };
            const handleBlur = () => {
                userInteractedWithPrompt = true;
            };

            document.addEventListener('visibilitychange', handleVisibilityChange);
            window.addEventListener('blur', handleBlur);


            window.location.href = deeplink_android;

            setTimeout(() => {
                document.removeEventListener('visibilitychange', handleVisibilityChange);
                window.removeEventListener('blur', handleBlur);

                const elapsed = Date.now() - startTime;

                if (!hasLeftPage && !userInteractedWithPrompt && elapsed < 3300) {

                    window.location.href = targetLink;

                    }
                }, 3000);
                return;
        } else {
            window.location.href = targetLink;
            return;
            }
        }
    if (isIOS()) {
        if (isAppBrowser()) {
            // iOS in-app browser → x-safari-https
            const iosRedirect = 'x-safari-https://www.outdoorsavannah.com/redirect?' + queryParams + encodedHash;
            window.location.href = iosRedirect;
            return;
        } else {
            window.location.replace(baseRedirect);
            return;
        }
    }
});
</script>

</head>
<body>
    <div class="profile-circle">
        <img alt="Profile" src="https://www.outdoorsavannah.com/wp-content/uploads/2025/04/cropped-profile-pic-yt_1.1.2-scaled-2-300x300.webp">
    </div>
</body>
</html>`;
};

console.log('🚀 Generating affiliate link preview pages...\n');

// --- Step 1: Generate preview pages for main content ---
console.log('📄 Generating main content previews...');

// Define pages to process
const pagesToProcess = [
    {
        slug: 'home',
        indexPath: path.join(rootDir, 'index.html'),
        productKey: 'home',
        outputFile: 'home.html'
    },
    {
        slug: 'cat-shelf-guide',
        indexPath: path.join(catShelfGuideDir, 'index.html'),
        productKey: 'cat-shelf-guide',
        outputFile: 'cat-shelf-guide.html'
    },
    {
        slug: 'product',
        indexPath: path.join(productDir, 'index.html'),
        productKey: 'product',
        outputFile: 'product.html'
    }
];

// Add all product subdirectories
if (fs.existsSync(productDir)) {
    const products = fs.readdirSync(productDir).filter(f =>
        fs.statSync(path.join(productDir, f)).isDirectory()
    );

    for (const productSlug of products) {
        pagesToProcess.push({
            slug: productSlug,
            indexPath: path.join(productDir, productSlug, 'index.html'),
            productKey: `product/${productSlug}`,
            outputFile: `${productSlug}.html`
        });
    }
}

// Generate preview pages
for (const page of pagesToProcess) {
    if (!fs.existsSync(page.indexPath)) {
        console.warn(`  ⚠️  No index.html found for ${page.slug} at ${page.indexPath}`);
        continue;
    }

    const html = fs.readFileSync(page.indexPath, "utf-8");
    const titleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
    const imageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
    const descMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
    const urlMatch = html.match(/<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i);

    const shouldUseProfileImage = page.slug === "home";
    const image = shouldUseProfileImage ? profileImageUrl : (imageMatch ? imageMatch[1] : "https://www.outdoorsavannah.com/default-og-image.webp");

    const meta = {
        title: titleMatch ? titleMatch[1] : page.slug,
        image: image,
        description: descMatch ? descMatch[1] : "",
        url: urlMatch ? urlMatch[1] : "",
    };

    const previewPath = path.join(previewDir, page.outputFile);
    const previewHtml = template(meta, page.productKey);

    fs.writeFileSync(previewPath, previewHtml, "utf-8");
    console.log(`  ✓ ${page.productKey} → /affiliate/${page.outputFile}`);
}

// --- Step 2: Generate Amazon affiliate variant pages ---
console.log('\n🛍️  Generating Amazon affiliate variant pages...');

// Load amazonLinks.json
let amazonLinks = {};
const amazonLinksPath = path.join(rootDir, "amazonLinks.json");
if (fs.existsSync(amazonLinksPath)) {
    amazonLinks = JSON.parse(fs.readFileSync(amazonLinksPath, "utf-8"));
} else {
    console.warn('  ⚠️  amazonLinks.json not found, skipping amzn pages');
}

// Generate amzn variant pages
if (amazonLinks.amzn) {
    const variantKeys = Object.keys(amazonLinks.amzn).filter(
        k => !k.endsWith("_deeplink_ios") && !k.endsWith("_deeplink_android")
    );

    console.log(`  Found ${variantKeys.length} amzn variants: ${variantKeys.join(', ')}`);

    for (const variantKey of variantKeys) {
        const deeplinkUrl = amazonLinks.amzn[variantKey + "_deeplink_ios"] || amazonLinks.amzn[variantKey];
        const productTitle = extractProductTitle(deeplinkUrl, variantKey);

        const meta = {
            title: productTitle ? `${productTitle} - Amazon Affiliate Link` : `${variantKey} - Amazon Affiliate Link`,
            image: profileImageUrl,
            description: "",
            url: "",
        };

        const previewPath = path.join(amznDir, `${variantKey}.html`);
        const previewHtml = template(meta, "amzn");

        fs.writeFileSync(previewPath, previewHtml, "utf-8");
        console.log(`  ✓ amzn/${variantKey} → /affiliate/amzn/${variantKey}.html ("${meta.title}")`);
    }
} else {
    console.log('  ⚠️  No "amzn" key found in amazonLinks.json');
}

console.log("\n✅ All affiliate preview pages generated!");
console.log(`\n📊 Summary:`);
console.log(`  • Main content previews: ${pagesToProcess.length} pages`);
console.log(`  • Amazon variants: ${amazonLinks.amzn ? Object.keys(amazonLinks.amzn).filter(k => !k.endsWith("_deeplink_ios") && !k.endsWith("_deeplink_android")).length : 0} pages`);
console.log(`  • Output directory: /affiliate/`);
console.log(`  • Amazon directory: /affiliate/amzn/`);
