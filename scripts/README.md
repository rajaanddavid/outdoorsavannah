# Static Site Deployment Scripts

## Quick Start

After exporting your WordPress site to static HTML and copying it to this repository, run:

```bash
node scripts/deploy-static-site.js
```

This runs all optimization scripts in the correct order.

---

## Master Script

### `deploy-static-site.js`
**Master deployment pipeline** - Runs all scripts below in the correct order. Stops immediately if any script fails.

**Usage:**
```bash
node scripts/deploy-static-site.js
```

---

## Individual Scripts (in execution order)

### 1. `generate-affiliate-links.js`
Generates affiliate redirect pages from product pages.

**What it does:**
- Creates `/affiliate/[product-name]/index.html` for each product
- Includes noindex/nofollow meta tags
- Sets up redirect to Amazon affiliate links

**Run manually:**
```bash
node scripts/generate-affiliate-links.js
```

---

### 2. `create-missing-sizes.js`
Creates missing responsive image sizes.

**What it does:**
- Scans all HTML for image references
- Checks if all srcset sizes exist
- Generates missing sizes (150x150, 240x240, etc.)

**Run manually:**
```bash
node scripts/create-missing-sizes.js
```

---

### 3. `make-images-responsive.js`
Converts `<img>` tags to responsive `<picture>` elements.

**What it does:**
- Wraps images in `<picture>` tags with WebP sources
- Adds srcset for multiple breakpoints
- Preserves image attributes and styling
- Ignores redirect.html

**Run manually:**
```bash
node scripts/make-images-responsive.js
```

**Reverse with:**
```bash
node scripts/restore-img-tags.js
```

---

### 4. `remove-render-blocking-css.js`
Removes render-blocking CSS files and inlines critical styles.

**What it does:**
- Downloads navigation.css and image.css from WordPress
- Extracts critical ponyfill styles
- Adds them to `/criticalcss` file
- Removes external CSS `<link>` tags from all HTML files
- **Saves ~1,490ms render-blocking time**

**Run manually:**
```bash
node scripts/remove-render-blocking-css.js
```

**Files modified:**
- `/criticalcss` - Updated with inlined CSS
- All `**/*.html` - External CSS links removed

---

### 5. `update-css.js`
Injects updated critical CSS into all HTML files.

**What it does:**
- Reads `/criticalcss` and `/non-criticalcss` files
- Inlines critical CSS in `<head>`
- Adds external link to `/css/custom.css`
- Skips `/affiliate` folder (uses different structure)

**Run manually:**
```bash
node scripts/update-css.js
```

---

### 6. `defer-ponyfill.js`
Defers ponyfill.css to make it non-render-blocking.

**What it does:**
- Changes ponyfill.css to load asynchronously
- Uses `media="print" onload="this.media='all'"` trick
- **Saves additional ~490ms render-blocking time**

**Run manually:**
```bash
node scripts/defer-ponyfill.js
```

---

### 7. `insertheaders.js`
Inserts header content (Google Analytics, etc.) into all pages.

**What it does:**
- Reads `/header.html` template
- Injects into all HTML files after `<head>` tag
- Applies to all pages including redirect.html

**Run manually:**
```bash
node scripts/insertheaders.js
```

---

## Utility Scripts

### `restore-img-tags.js`
Reverses `make-images-responsive.js` - removes `<picture>` wrappers and restores original `<img>` tags.

**Usage:**
```bash
node scripts/restore-img-tags.js
```

---

## Configuration Files

- `/criticalcss` - Critical CSS (inlined in every page)
- `/non-criticalcss` - Non-critical CSS (external file)
- `/css/custom.css` - Generated from non-criticalcss
- `/header.html` - Header template for all pages
- `/body.html` - Body template for all pages

---

## Adding New Scripts

To add a new script to the deployment pipeline:

1. Create your script in `/scripts/`
2. Test it independently
3. Edit `deploy-static-site.js`
4. Add a new `runScript()` call in the correct position:

```javascript
runScript(
  'your-script.js',
  'Step X/Y: Description of what your script does'
);
```

**Important:** Update the step numbers when adding new scripts!

---

## Performance Impact

**Total render-blocking CSS elimination:**
- Before: 4 files, ~1,980ms blocking time
- After: 0 files, all critical CSS inlined
- **Result: ~2 second improvement in First Contentful Paint**

---

## Troubleshooting

**Script fails with "file not found":**
- Ensure you're running from repository root
- Check that all required files exist in `/scripts/`

**Images not responsive:**
- Run `create-missing-sizes.js` first
- Check that source images exist in `/wp-content/uploads/`

**CSS not updating:**
- Check `/criticalcss` and `/non-criticalcss` files exist
- Run `update-css.js` after modifying CSS files

**Deployment stops:**
- Fix the error in the failed script
- Re-run `deploy-static-site.js` (safe to run multiple times)
