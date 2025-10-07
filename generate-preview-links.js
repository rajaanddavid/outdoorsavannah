/**
 * generatePreviews.js
 *
 * Generates /preview/*.html static redirect pages
 **/

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Paths ---
const productDir = path.join(__dirname, "product");
const previewDir = path.join(__dirname, "preview");

// --- Ensure preview directory exists ---
if (!fs.existsSync(previewDir)) fs.mkdirSync(previewDir);

// --- Facebook & Twitter IDs ---
const fbAppId = "1234567890"; // replace with your actual FB App ID
const twitterSite = "@outdoorsavannah";
const twitterCreator = "@outdoorsavannah";

// --- Template ---
const template = (meta, slug) => `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${meta.title}</title>

    <!-- Open Graph -->
    <meta property="og:title" content="${meta.title}">
    <meta property="og:image" content="${meta.image}">
    <meta property="og:locale" content="${meta.locale || 'en_US'}">
    <meta property="og:site_name" content="${meta.siteName || 'Raja and David® - OutdoorSavannah®'}">
    <meta property="og:type" content="${meta.type || 'article'}">
    <meta property="og:description" content="${meta.description || ''}">
    <meta property="og:url" content="${meta.url || ''}">
    <meta property="og:image:secure_url" content="${meta.image}">
    <meta property="og:image:width" content="${meta.imageWidth || '819'}">
    <meta property="og:image:height" content="${meta.imageHeight || '1024'}">
    <meta property="og:image:alt" content="${meta.imageAlt || ''}">
    <meta property="og:updated_time" content="${meta.updatedTime || new Date().toISOString()}">
    <meta property="fb:app_id" content="${fbAppId}">

    <!-- Twitter -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${meta.title}">
    <meta name="twitter:description" content="${meta.description || ''}">
    <meta name="twitter:image" content="${meta.image}">
    <meta name="twitter:site" content="${twitterSite}">
    <meta name="twitter:creator" content="${twitterCreator}">

    <meta name="robots" content="noindex, nofollow">

    <script>
    document.addEventListener("DOMContentLoaded", function() {
        const url = new URL(window.location.href);

        // Use slug from generator as fallback
        let slug = "${slug}";

        // Support extracting slug from the path
        const pathSegments = url.pathname.split("/").filter(Boolean); // ["preview", "wall-crawler-gecko"]
        if (pathSegments[0] === "preview" && pathSegments[1]) {
            slug = pathSegments[1];
        }

        // Preserve variant and hash (also allow for &variant= and ?variant=
        let variant = url.searchParams.get('variant');

        // fallback if variant is in path like &variant=aliexpress
        if (!variant && slug.includes("&variant=")) {
            const parts = slug.split("&variant=");
            slug = parts[0];
            variant = parts[1];
        }
        let redirectUrl = "/redirect.html?product=product/" + slug;
        if (variant) redirectUrl += "&variant=" + encodeURIComponent(variant);
        if (url.hash) redirectUrl += url.hash;

        // Redirect
        window.location.replace(redirectUrl);
    });
    </script>
</head>
<body>
    <p>Redirecting to product...</p>
</body>
</html>`;

// --- Read all product subdirectories ---
const products = fs.readdirSync(productDir).filter(f => {
    return fs.statSync(path.join(productDir, f)).isDirectory();
});

// --- Process each product ---
for (const slug of products) {
    const indexPath = path.join(productDir, slug, "index.html");
    if (!fs.existsSync(indexPath)) {
        console.warn(`⚠️ No index.html found for ${slug}`);
        continue;
    }

    const html = fs.readFileSync(indexPath, "utf-8");

    // --- Extract OG title & image ---
    const titleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
    const imageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
    const descMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
    const urlMatch = html.match(/<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i);

    const meta = {
        title: titleMatch ? titleMatch[1] : slug,
        image: imageMatch ? imageMatch[1] : "https://www.outdoorsavannah.com/default-og-image.webp",
        description: descMatch ? descMatch[1] : "",
        url: urlMatch ? urlMatch[1] : "",
        updatedTime: new Date().toISOString(),
    };

    const previewHtml = template(meta, slug);
    const previewPath = path.join(previewDir, `${slug}.html`);

    fs.writeFileSync(previewPath, previewHtml, "utf-8");
    console.log(`✅ Generated preview for ${slug}`);
}

console.log("\n🎉 All preview pages generated successfully!");
