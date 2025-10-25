import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const productDir = path.join(__dirname, "product");
const previewDir = path.join(__dirname, "affiliate");

if (!fs.existsSync(previewDir)) fs.mkdirSync(previewDir);

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

<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-NBJRDCGV');</script>
<!-- End Google Tag Manager -->

<!-- Google tag (gtag.js) for GA4 (Analytics)-->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-0Q38LVTQS4"></script>
<script>window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  gtag('config', 'G-0Q38LVTQS4');</script>

<script>
document.addEventListener("DOMContentLoaded", async function() {
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isAndroid = /Android/i.test(navigator.userAgent);
    const isMobile = isIOS || isAndroid;

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

    if (!isMobile) {
        const validKeys = Object.keys(productLinks).filter(
            k => !k.endsWith("_deeplink_ios") && !k.endsWith("_deeplink_android")
        );
        const targetKey = variant && validKeys.find(k => k.toLowerCase() === variant.toLowerCase()) ? variant : validKeys[0];
        const targetLink = productLinks[targetKey] || '/';
        window.location.replace(targetLink);
        return;
    }

    if (isMobile) {
        const redirectUrl = "/redirect.html?product=" + encodeURIComponent(productKey) + (variant ? "&variant=" + encodeURIComponent(variant) : "");
        window.location.replace(redirectUrl + hash);
    }
});
</script>

</head>
<body>
<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-NBJRDCGV"
                  height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->
    <div class="profile-circle">
        <img src="https://www.outdoorsavannah.com/wp-content/uploads/2025/04/cropped-profile-pic-yt_1.1.2-scaled-2-300x300.webp" alt="Profile">
    </div>
</body>
</html>`;
};

// --- Protected static pages ---
const protectedPages = ["home", "product", "cat-shelf-guide"];

// --- Read product subdirectories ---
const products = fs.readdirSync(productDir).filter(f =>
    fs.statSync(path.join(productDir, f)).isDirectory()
);

// --- Combine all pages ---
const allPages = [...protectedPages, ...products];

// --- Load amazonLinks.json ---
let amazonLinks = {};
const amazonLinksPath = path.join(__dirname, "amazonLinks.json");
if (fs.existsSync(amazonLinksPath)) {
    amazonLinks = JSON.parse(fs.readFileSync(amazonLinksPath, "utf-8"));
}

// --- Generate preview pages ---
for (const slug of allPages) {
    let indexPath;
    let productKey;

    switch(slug) {
        case "home":
            indexPath = path.join(__dirname, "index.html");
            productKey = "home";
            break;
        case "cat-shelf-guide":
            indexPath = path.join(__dirname, "cat-shelf-guide", "index.html");
            productKey = "cat-shelf-guide";
            break;
        case "product":
            indexPath = path.join(__dirname, "product", "index.html");
            productKey = "product";
            break;
        default:
            indexPath = path.join(productDir, slug, "index.html");
            productKey = `product/${slug}`;
    }

    if (!fs.existsSync(indexPath)) {
        console.warn(`⚠️ No index.html found for ${slug} at ${indexPath}`);
        continue;
    }

    const html = fs.readFileSync(indexPath, "utf-8");
    const titleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
    const imageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
    const descMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
    const urlMatch = html.match(/<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i);

    const shouldUseProfileImage = slug === "home";
    const image = shouldUseProfileImage ? profileImageUrl : (imageMatch ? imageMatch[1] : "https://www.outdoorsavannah.com/default-og-image.webp");

    const meta = {
        title: titleMatch ? titleMatch[1] : slug,
        image: image,
        description: descMatch ? descMatch[1] : "",
        url: urlMatch ? urlMatch[1] : "",
    };

    const fileName = `${slug}.html`;
    const previewPath = path.join(previewDir, fileName);

    let previewHtml = template(meta, productKey);

    fs.writeFileSync(previewPath, previewHtml, "utf-8");
    console.log(`✅ Generated preview for ${productKey}`);
}

// --- Special handling for amzn variants ---
if (amazonLinks.amzn) {
    const amznDir = path.join(previewDir, "amzn");
    if (!fs.existsSync(amznDir)) fs.mkdirSync(amznDir, { recursive: true });

    const variantKeys = Object.keys(amazonLinks.amzn).filter(
        k => !k.endsWith("_deeplink_ios") && !k.endsWith("_deeplink_android")
    );

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
        let previewHtml = template(meta, "amzn");

        fs.writeFileSync(previewPath, previewHtml, "utf-8");
        console.log(`✅ Generated amzn variant preview: ${variantKey} → "${meta.title}"`);
    }
}

console.log("\n🎉 All preview pages generated!");