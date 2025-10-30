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
        min-height: 100dvh;
        display: flex;
        justify-content: center;
        align-items: center;
        background: #f5f5f5;
    }

    .profile-circle {
        width: 40vw;
        max-width: 160px;
        aspect-ratio: 1;
        border-radius: 50%;
        overflow: hidden;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
        margin: 16px 0;
    }

    .profile-circle img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .overlay-text {
      line-height: 1.4;
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
    const _isChromiumAndroid =
      ua.includes('Android') &&
      (ua.includes('Chrome') || ua.includes('Edg') || ua.includes('OPR') || ua.includes('Brave'));

    // Return cached values
    function isMobile() { return _isMobile; }
    function isAndroid() { return _isAndroid; }
    function isIOS() { return _isIOS; }
    function isAppBrowser() { return _isAppBrowser; }
    function isChromiumAndroid() { return _isChromiumAndroid; }

    // show overlay button for external Chromium Android users so they can deeplink or move ahead faster
    function showChromiumAndroidButton(deeplink_android, targetLink) {
        const overlay = document.createElement('div');
        overlay.id = 'tap-overlay';
        overlay.style.cssText = "position: fixed; inset: 0; background: rgba(0,0,0,0.6); color: white; z-index: 999999; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; cursor: pointer; font-size: 20px; font-weight: 500; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-tap-highlight-color: transparent; user-select: none; touch-action: manipulation;";

        // Create text elements positioned relative to viewport center
        const topText = document.createElement('div');
        topText.textContent = 'Redirecting...';
        topText.style.cssText = "position: absolute; top: 35%; font-size: 20px; opacity: 1;";

        const bottomText = document.createElement('div');
        bottomText.textContent = 'or tap anywhere';
        bottomText.style.cssText = "position: absolute; bottom: 35%; font-size: 20px; opacity: 1;";

        // Append all elements
        overlay.appendChild(topText);
        overlay.appendChild(bottomText);

        overlay.addEventListener('click', () => {
            // Fade out smoothly
          overlay.style.transition = 'opacity 0.25s ease';
          overlay.style.opacity = '0';

          // Fire deeplink
          const iframe = document.createElement('iframe');
          iframe.style.display = 'none';
          iframe.src = deeplink_android;
          document.body.appendChild(iframe);

          // Small delay before fallback
          setTimeout(() => {
            iframe.remove();
            overlay.remove(); // remove from DOM so it doesn’t block taps
            window.location.replace(targetLink);
          }, 20);
        });

        document.body.appendChild(overlay);
    }

    // show overlay button for external Safari users coming from affiliate link so they can deeplink or move ahead faster
    function showSafariButton(deeplink_ios, targetLink) {
        const overlay = document.createElement('div');
        overlay.id = 'tap-overlay';
        overlay.style.cssText = "position: fixed; inset: 0; background: rgba(0,0,0,0.6); color: white; z-index: 999999; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; cursor: pointer; font-size: 20px; font-weight: 500; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-tap-highlight-color: transparent; user-select: none; touch-action: manipulation;";

        // Create text elements positioned relative to viewport center
        const topText = document.createElement('div');
        topText.textContent = 'Redirecting...';
        topText.style.cssText = "position: absolute; top: 35%; font-size: 20px; opacity: 1;";

        const bottomText = document.createElement('div');
        bottomText.textContent = 'or tap anywhere';
        bottomText.style.cssText = "position: absolute; bottom: 35%; font-size: 20px; opacity: 1;";

        // Append all elements
        overlay.appendChild(topText);
        overlay.appendChild(bottomText);

        overlay.addEventListener('click', () => {
            // Fade out smoothly
          overlay.style.transition = 'opacity 0.25s ease';
          overlay.style.opacity = '0';

          // Fire deeplink
          const iframe = document.createElement('iframe');
          iframe.style.display = 'none';
          iframe.src = deeplink_ios;
          document.body.appendChild(iframe);

          // Small delay before fallback
          setTimeout(() => {
            iframe.remove();
            overlay.remove(); // remove from DOM so it doesn’t block taps
            window.location.replace(targetLink);
          }, 50);
        });

        document.body.appendChild(overlay);
    }

    // --- Universal normalizeIntentLink for Android ---
    function normalizeIntentLink(url, fallback) {
      console.log("[normalizeIntentLink] Input:", { url: url, fallback: fallback });

      if (!url) return url;

      try {
        let prefix, intentPart, originalPath, normalizedPath, browserFallback;

        // --- Handle intent:// URLs ---
        if (url.startsWith("intent://")) {
          [prefix, intentPart] = url.split("#Intent;");
          console.log("[normalizeIntentLink] prefix, intentPart:", prefix, intentPart);
          if (!intentPart) return url;

          // Extract scheme and force https
          var schemeMatch = intentPart.match(/scheme=([^;]+)/);
          var scheme = "https";
          console.log("[normalizeIntentLink] scheme:", scheme);

          // Clean intent parameters: remove package/component/end/browser fallback
          var filteredParts = intentPart.split(";").filter(function(part) {
            return !part.startsWith("package=") &&
                   !part.startsWith("component=") &&
                   !part.trim().startsWith("end");
          }).map(function(part) {
            return part.startsWith("scheme=") ? "scheme=" + scheme : part;
          });
          console.log("[normalizeIntentLink] filteredParts:", filteredParts);

          // Extract originalPath
          originalPath = prefix.replace(/^intent:\\/\\//, "");
          console.log("[normalizeIntentLink] originalPath:", originalPath);

          function normalizeFallbackUrl(url) {
            if (!url) return null;
            url = url.trim();
            if (/^https?:\\/\\//i.test(url)) return url;
            return "https://" + url.replace(/^https?:\\/\\//i, "");
          }

          function isValidUrl(url) {
            try { new URL(url); return true; } catch (err) { return false; }
          }

          function detectTldInIntent(url) {
            var hostMatch = url.replace(/^intent:\\/\\//, "").split("#Intent")[0].match(/^([^\\/?#@]+)/);
            if (!hostMatch) return false;
            var host = hostMatch[1].toLowerCase();
            var parts = host.split(".");
            if (parts.length < 2) return false;
            var tld = parts.slice(-2).join(".");
            return /^[a-z0-9-]+(\\.[a-z0-9-]+)+$/i.test(tld);
          }

          var isTld = detectTldInIntent(url);
          console.log("[normalizeIntentLink] isTld:", isTld);

          var existingFallbackMatch = url.match(/S\\.browser_fallback_url=([^;]+)/);
          if (existingFallbackMatch) {
            browserFallback = decodeURIComponent(existingFallbackMatch[1]);
            console.log("[normalizeIntentLink] Found existing S.browser_fallback_url:", browserFallback);
            browserFallback = normalizeFallbackUrl(browserFallback);
            if (!isValidUrl(browserFallback)) {
              console.warn("[normalizeIntentLink] Invalid fallback detected, using default targetLink");
              browserFallback = normalizeFallbackUrl(fallback);
            }
          } else {
            browserFallback = fallback.indexOf("https://") === 0
              ? fallback
              : "https://" + fallback.replace(/^https?:\\/\\//, "");
            console.log("[normalizeIntentLink] browserFallback (from fallback param):", browserFallback);
          }

          if (isTld) {
            normalizedPath = originalPath;
          } else {
            var fallbackHostMatch = fallback.replace(/^https?:\\/\\//, "").match(/^([a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})/);
            var fallbackHost = fallbackHostMatch ? fallbackHostMatch[1] : fallback.replace(/^https?:\\/\\//, "");
            normalizedPath = fallbackHost + "/" + originalPath;
          }

          var intentPrefix = "intent://" + normalizedPath;
          var normalizedIntent = intentPrefix + "#Intent;" + filteredParts.join(";") + ";action=android.intent.action.VIEW";
          if (!existingFallbackMatch) {
            normalizedIntent += ";S.browser_fallback_url=" + encodeURIComponent(browserFallback);
          }
          normalizedIntent += ";end";

          normalizedIntent = normalizedIntent.replace(/;;+/g, ";");

          console.log("[normalizeIntentLink] normalizedPath:", normalizedPath);
          console.log("[normalizeIntentLink] normalizedIntent:", normalizedIntent);
          return normalizedIntent;
        }

        // --- Handle app:// URLs ---
        if (/^com\\./.test(url)) {
          var path = url.replace(/^com\\.[a-zA-Z0-9._-]+:\\/\\//, "");
          console.log("[normalizeIntentLink] app:// path:", path);

          browserFallback = fallback.indexOf("https://") === 0
            ? fallback
            : "https://" + fallback.replace(/^https?:\\/\\//, "");
          console.log("[normalizeIntentLink] browserFallback for app://:", browserFallback);

          var normalizedIntent = ("intent://" + path + "#Intent;scheme=https;action=android.intent.action.VIEW;S.browser_fallback_url=" + encodeURIComponent(browserFallback) + ";end").replace(/;;+/g, ";");
          console.log("[normalizeIntentLink] normalizedIntent for app://:", normalizedIntent);
          return normalizedIntent;
        }

        console.log("[normalizeIntentLink] URL returned as-is");
        return url;

      } catch (err) {
        console.error("[normalizeIntentLink] error:", err);
        return url;
      }
    }

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
    // const skipParam = queryParams ? '&skipDeeplink=true' : 'skipDeeplink=true';
    // const iosExternalParam = queryParams ? '&iosExternalAffiliate=true' : 'iosExternalAffiliate=true';

    if (isAndroid()) {
        if (isAppBrowser()) {
            const now = Date.now();

            const deeplink_android = productLinks[targetKey + '_deeplink_android'];
            const normalizedDeeplink = normalizeIntentLink(deeplink_android, targetLink);
            window.location.href = normalizedDeeplink;

            setTimeout(() => {
                window.location.replace("https://www.outdoorsavannah.com");
            }, 2400);
            return;
        } else if (isChromiumAndroid()) {
            const deeplink_android = productLinks[targetKey + '_deeplink_android'];
            const now = Date.now();

            window.location.href = deeplink_android;
            showChromiumAndroidButton(deeplink_android, targetLink);

            setTimeout(() => {
                const elapsed = Date.now() - now;
                if (elapsed < 1200) {
                    window.location.replace(targetLink);
                    }
                }, 900);
                return;
        } else {
            window.location.href = targetLink;
            return;
            }
        }
    if (isIOS()) {
        if (isAppBrowser()) {
            // iOS in-app browser → x-safari-https
            const currentUrl = window.location.href;
            const safariUrl = 'x-safari-' + targetLink;
            window.location.href = safariUrl;

            setTimeout(() => {
                window.location.replace("https://www.outdoorsavannah.com");
            }, 2400);
            return;
        } else {
            const now = Date.now();
            const deeplink_ios = productLinks[targetKey + '_deeplink_ios'];

            showSafariButton(deeplink_ios, targetLink)
            console.log("[iosExternalAffiliate] deeplink_ios:", deeplink_ios);
            console.log("[iosExternalAffiliate] targetLink:", targetLink);

            setTimeout(() => {
                const elapsed = Date.now() - now;
                if (elapsed < 1200) {
                    window.location.href = targetLink;
                    }
                }, 900);
                return;
                }
    } else {
        window.location.replace(targetLink);
        return;
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
