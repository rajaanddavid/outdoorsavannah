import fs from 'fs/promises';
import path from 'path';

// --- Configuration ---
const rootDir = './'; // root folder to scan
const headerFile = './header.html';
const bodyFile = './body.html';

const headerStart = '<!-- START HEADER SNIPPET -->';
const headerEnd = '<!-- END HEADER SNIPPET -->';
const bodyStart = '<!-- START BODY SNIPPET -->';
const bodyEnd = '<!-- END BODY SNIPPET -->';

// --- Recursive function to find all index.html files ---
async function getHtmlFiles(dir) {
  let results = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(await getHtmlFiles(fullPath));
    } else if (entry.isFile() && ['index.html', '404.html', 'redirect.html'].includes(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

// --- Function to replace snippet between markers ---
function replaceSnippet(content, startMarker, endMarker, newSnippet) {
  const regex = new RegExp(`${startMarker}[\\s\\S]*?${endMarker}`, 'i');
  if (!regex.test(content)) {
    console.warn(`Markers not found: ${startMarker} / ${endMarker}`);
    return content;
  }
  return content.replace(regex, `${startMarker}\n${newSnippet}\n${endMarker}`);
}

// --- Main script ---
async function main() {
  const [headerSnippet, bodySnippet] = await Promise.all([
    fs.readFile(headerFile, 'utf-8'),
    fs.readFile(bodyFile, 'utf-8')
  ]);

  const files = await getHtmlFiles(rootDir);
  console.log(`Found ${files.length} index.html files.`);

  for (const file of files) {
    let content = await fs.readFile(file, 'utf-8');
    const originalContent = content;

    content = replaceSnippet(content, headerStart, headerEnd, headerSnippet);
    content = replaceSnippet(content, bodyStart, bodyEnd, bodySnippet);

    if (content !== originalContent) {
      await fs.writeFile(file, content, 'utf-8');
      console.log(`Updated: ${file}`);
    } else {
      console.log(`Markers not found in: ${file}, skipping.`);
    }
  }
}

main().catch(err => console.error(err));
