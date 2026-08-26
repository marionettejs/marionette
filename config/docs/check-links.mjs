import { readFile, readdir } from 'fs/promises';
import { dirname, relative, resolve, sep } from 'path';
import { fileURLToPath } from 'url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const outputDir = resolve(rootDir, '.docs-site');
const siteOrigin = 'https://docs.marionettejs.com';

async function findFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const target = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...await findFiles(target));
    } else {
      files.push(target);
    }
  }

  return files;
}

function publicPath(filePath) {
  const path = relative(outputDir, filePath).split(sep).join('/');
  return `/${path.replace(/index\.html$/, '')}`;
}

function targetFile(url) {
  const decodedPath = decodeURIComponent(url.pathname);
  const relativePath = decodedPath.replace(/^\/+/, '');

  if (!relativePath || decodedPath.endsWith('/')) {
    return resolve(outputDir, relativePath, 'index.html');
  }

  return resolve(outputDir, relativePath);
}

function collectAnchors(html, pagePath, errors) {
  const anchors = new Set();
  const pattern = /\b(?:id|name)="([^"]+)"/g;
  let match;

  while ((match = pattern.exec(html))) {
    const anchor = decodeURIComponent(match[1]);

    if (anchors.has(anchor)) {
      errors.push(`${pagePath}: duplicate anchor #${anchor}`);
    }

    anchors.add(anchor);
  }

  return anchors;
}

async function checkLinks() {
  const files = await findFiles(outputDir);
  const htmlFiles = files.filter(file => file.endsWith('.html'));
  const outputFiles = new Set(files.map(file => resolve(file)));
  const pages = new Map();
  const errors = [];
  let linkCount = 0;

  for (const filePath of htmlFiles) {
    const html = await readFile(filePath, 'utf8');
    const path = publicPath(filePath);
    pages.set(resolve(filePath), {
      anchors: collectAnchors(html, path, errors),
      html,
      path,
    });
  }

  for (const page of pages.values()) {
    const pattern = /<(?:a|link)\b[^>]*\bhref="([^"]+)"|<(?:img|script)\b[^>]*\bsrc="([^"]+)"/gi;
    let match;

    while ((match = pattern.exec(page.html))) {
      const reference = match[1] || match[2];

      if (/^(?:mailto:|tel:|data:)/i.test(reference)) {
        continue;
      }

      const url = new URL(reference, `${siteOrigin}${page.path}`);

      if (url.origin !== siteOrigin) {
        continue;
      }

      linkCount += 1;
      const filePath = targetFile(url);
      const target = pages.get(filePath);

      if (!outputFiles.has(filePath)) {
        errors.push(`${page.path}: ${reference} does not resolve`);
        continue;
      }

      if (url.hash) {
        const anchor = decodeURIComponent(url.hash.slice(1));

        if (!target || !target.anchors.has(anchor)) {
          errors.push(`${page.path}: ${reference} has no matching anchor`);
        }
      }
    }
  }

  if (errors.length) {
    console.error(`Documentation validation failed with ${errors.length} error(s):`);
    errors.forEach(error => console.error(`- ${error}`));
    process.exit(1);
  }

  console.log(`Validated ${pages.size} HTML files and ${linkCount} internal links.`);
}

checkLinks();
