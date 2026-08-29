import { readFile, rm, mkdir, writeFile, copyFile } from 'fs/promises';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { marked, Renderer } from 'marked';
import { loadDiagnosticCatalog } from '../../scripts/diagnostics/catalog.mjs';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const siteDir = resolve(rootDir, 'docs-site');
const pagesDir = resolve(siteDir, 'pages');
const outputDir = resolve(rootDir, '.docs-site');
const canonicalOrigin = 'https://docs.marionettejs.com';
const docRoutes = new Map();
const markdownRenderer = new Renderer();
let packageVersion;

function diagnosticIndex(diagnostics) {
  const rows = diagnostics.map(({ code, slug, severity }) => {
    return `| [${code}](/errors/${code}/) | ${slug} | ${severity} |`;
  });

  return [
    '## Catalog',
    '',
    '| Code | Diagnostic | Severity |',
    '| --- | --- | --- |',
    ...rows,
  ].join('\n');
}

export function diagnosticPage(diagnostic) {
  const objects = diagnostic.objects.map(object => `\`${object}\``).join(', ');
  const surfaces = diagnostic.surfaces.map(surface => `\`${surface}\``).join(', ');
  const replacement = diagnostic.replacementCode ?
    `\n| Replacement | [${diagnostic.replacementCode}](/errors/${diagnostic.replacementCode}/) |` :
    '';

  return `# ${diagnostic.code}: ${diagnostic.slug}

| Field | Value |
| --- | --- |
| Status | ${diagnostic.status} |
| Category | ${diagnostic.category} |
| Severity | ${diagnostic.severity} |
| Objects | ${objects} |
| Surfaces | ${surfaces} |
| Benchmark category | ${diagnostic.benchmarkCategory} |${replacement}

## Remediation

${diagnostic.remediation}
`;
}

markdownRenderer.html = token => escapeHtml(token.raw);

function decodeEntities(value) {
  const named = {
    amp: '&',
    apos: '\'',
    gt: '>',
    lt: '<',
    quot: '"',
  };

  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, code) => {
    if (code[0] === '#') {
      const radix = code[1].toLowerCase() === 'x' ? 16 : 10;
      const digits = radix === 16 ? code.slice(2) : code.slice(1);
      return String.fromCodePoint(parseInt(digits, radix));
    }

    return named[code.toLowerCase()] || entity;
  });
}

function textFromHeading(value) {
  return decodeEntities(value.replace(/<[^>]+>/g, ''));
}

function createSlugger() {
  const occurrences = new Map();

  return value => {
    const base = textFromHeading(value)
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s/g, '-');
    const occurrence = occurrences.get(base) || 0;
    occurrences.set(base, occurrence + 1);
    return occurrence ? `${base}-${occurrence}` : base;
  };
}

function addHeadingIds(html) {
  const slug = createSlugger();

  return html.replace(/<h([1-6])>([\s\S]*?)<\/h\1>/g, (heading, level, contents) => {
    return `<h${level} id="${slug(contents)}">${contents}</h${level}>`;
  });
}

function rewriteDocLinks(html, sourcePath) {
  return html.replace(/(<a\b[^>]*\bhref=")([^"]+)(")/gi, (link, prefix, href, suffix) => {
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#|\/)/i.test(href)) {
      return link;
    }

    const hashIndex = href.indexOf('#');
    const pathPart = hashIndex === -1 ? href : href.slice(0, hashIndex);
    const hashPart = hashIndex === -1 ? '' : href.slice(hashIndex);

    if (!/\.md$/i.test(pathPart)) {
      return link;
    }

    const target = resolve(dirname(sourcePath), pathPart);
    const targetRoute = docRoutes.get(target);

    if (!targetRoute) {
      return link;
    }

    return `${prefix}/${targetRoute ? `${targetRoute}/` : ''}${hashPart}${suffix}`;
  });
}

function renderMarkdown(markdown, sourcePath) {
  const rendered = marked.parse(markdown, {
    gfm: true,
    renderer: markdownRenderer,
  });
  const linked = sourcePath ? rewriteDocLinks(rendered, sourcePath) : rendered;
  return addHeadingIds(linked);
}

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function pageTemplate({ body, canonicalPath, title }) {
  const canonicalUrl = `${canonicalOrigin}${canonicalPath}`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)} | Marionette</title>
    <meta name="description" content="Marionette framework documentation">
    <link rel="canonical" href="${canonicalUrl}">
    <link rel="stylesheet" href="/assets/styles.css">
  </head>
  <body>
    <header class="site-header">
      <a class="brand" href="/">Marionette</a>
      <nav aria-label="Documentation">
        <a href="/next/">Next</a>
        <a href="/v5/">Stable v5</a>
        <a href="/releases/">Releases</a>
        <a href="/errors/">Diagnostics</a>
      </nav>
    </header>
    <main>${body}</main>
    <footer>Marionette ${escapeHtml(packageVersion)} documentation</footer>
  </body>
</html>
`;
}

function titleFromHtml(html, fallback) {
  const heading = html.match(/<h1 id="[^"]*">([\s\S]*?)<\/h1>/);
  return heading ? textFromHeading(heading[1]) : fallback;
}

async function writePage(route, markdown, sourcePath, fallbackTitle) {
  const body = renderMarkdown(markdown, sourcePath);
  const canonicalPath = `/${route ? `${route}/` : ''}`;
  const destination = resolve(outputDir, route, 'index.html');
  const title = titleFromHtml(body, fallbackTitle);

  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, pageTemplate({ body, canonicalPath, title }));
}

async function buildDocs() {
  const packageJson = JSON.parse(await readFile(resolve(rootDir, 'package.json'), 'utf8'));
  const diagnosticCatalog = await loadDiagnosticCatalog();
  packageVersion = packageJson.version;

  await rm(outputDir, { force: true, recursive: true });
  await mkdir(resolve(outputDir, 'assets'), { recursive: true });

  const scaffoldPages = [
    ['', 'index.md', 'Documentation'],
    ['v5', 'v5.md', 'Stable v5'],
    ['releases', 'releases.md', 'Releases'],
    ['errors', 'errors.md', 'Diagnostics'],
  ];

  for (const [route, fileName, title] of scaffoldPages) {
    const sourcePath = resolve(pagesDir, fileName);
    let markdown = await readFile(sourcePath, 'utf8');

    if (route === 'errors') {
      markdown = `${markdown.trim()}\n\n${diagnosticIndex(diagnosticCatalog.diagnostics)}\n`;
    }

    await writePage(route, markdown, null, title);
  }

  for (const diagnostic of diagnosticCatalog.diagnostics) {
    const route = diagnostic.docsAnchor.replace(/^\/+|\/+$/g, '');
    await writePage(route, diagnosticPage(diagnostic), null, diagnostic.code);
  }

  const nextDocs = JSON.parse(await readFile(resolve(siteDir, 'next.json'), 'utf8'));
  const docSources = nextDocs.map(({ route, source }) => ({
    fileName: source,
    route,
    sourcePath: resolve(rootDir, source),
  }));

  docSources.forEach(({ route, sourcePath }) => docRoutes.set(sourcePath, route));

  for (const { fileName, route, sourcePath } of docSources) {
    await writePage(route, await readFile(sourcePath, 'utf8'), sourcePath, fileName);
  }

  await copyFile(resolve(siteDir, 'assets/styles.css'), resolve(outputDir, 'assets/styles.css'));
  await copyFile(resolve(siteDir, 'CNAME'), resolve(outputDir, 'CNAME'));
  await writeFile(resolve(outputDir, '.nojekyll'), '');
  await writeFile(
    resolve(outputDir, '404.html'),
    pageTemplate({
      body: '<h1 id="not-found">Documentation page not found</h1><p><a href="/">Return to the documentation index.</a></p>',
      canonicalPath: '/404.html',
      title: 'Not found',
    }),
  );

  const pageCount = docSources.length + scaffoldPages.length + diagnosticCatalog.diagnostics.length;
  console.log(`Built ${pageCount} documentation pages in .docs-site/.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildDocs();
}
