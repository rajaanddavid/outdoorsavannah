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

// --- Template ---
const template = (title, image, slug) => `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <meta property="og:title" content="${title}">
    <meta property="og:image" content="${image}">
    <meta name="robots" content="noindex, nofollow">

    <script>
        document.addEventListener("DOMContentLoaded", function() {
            const url = new URL(window.location.href);
            const variant = url.searchParams.get('variant');
            const hash = window.location.hash;
            const slug = "${slug}";
            let redirectUrl = "/redirect.html?product=product/" + slug;
            if (variant) redirectUrl += "&variant=" + encodeURIComponent(variant);
            if (hash) redirectUrl += hash;
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

    const title = titleMatch ? titleMatch[1] : slug;
    const image = imageMatch ? imageMatch[1] : "https://www.outdoorsavannah.com/default-og-image.webp";

    const previewHtml = template(title, image, slug);
    const previewPath = path.join(previewDir, `${slug}.html`);

    fs.writeFileSync(previewPath, previewHtml, "utf-8");
    console.log(`✅ Generated preview for ${slug}`);
}

console.log("\n🎉 All preview pages generated successfully!");
