import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmod, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import { contentDigest } from '../../../scripts/docs/export.mjs';
import { documentSections, isConsumerPage, plainHeading } from '../../../scripts/docs/sections.mjs';
import { symbolIndex } from '../../../scripts/docs/symbols.mjs';
import { validateSymbolIndex } from '../../../skills/marionette/scripts/symbols.mjs';

// Reconstruct only the frozen upstream consumer delivery. Never export benchmark
// or evaluator resources, read reserved tasks, build a runtime, or repair prose.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const revision = '74534f719e9ae6bf00fb6061e9f8cb712e92e2ef';
const revisedFreeze = process.argv[2];
if (!revisedFreeze) { throw new Error('Pass the immutable revised freeze directory.'); }
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const fromGit = path => execFileSync('git', ['show', `${revision}:${path}`], { cwd: root, maxBuffer: 32 * 1024 * 1024 });
const originalJson = path => JSON.parse(fromGit(path));
const navigation = originalJson('docs-site/navigation.json');
const resources = originalJson('docs-site/resources.json');
const originalPackage = originalJson('package.json');
// These are the exact asset exclusions in upstream scripts/docs/package.mjs.
const packageExcluded = source => source.startsWith('benchmarks/') || source.startsWith('config/api-contracts/') ||
  source.startsWith('scripts/api-contracts/') || source === 'ROADMAP.md' || source.startsWith('test/unit/') || source === 'test/README.md';
const directory = await mkdtemp(resolve(tmpdir(), 'marionette-v5-baseline-freeze-20260930-'));
const corpus = resolve(directory, 'baseline-package');
const files = new Map();
const originalHashes = {};
const add = (path, bytes, original = false) => {
  if (files.has(path) && !files.get(path).equals(bytes)) { throw new Error(`Conflicting bytes for ${path}`); }
  files.set(path, bytes);
  if (original) { originalHashes[path] = sha256(bytes); }
};
const selectedPages = navigation.filter(isConsumerPage);
for (const page of selectedPages) { add(page.source, fromGit(page.source), true); }
const selectedResources = resources.filter(source => !packageExcluded(source));
for (const source of selectedResources) { add(source, fromGit(source), true); }
for (const file of originalPackage.files) {
  if (file.endsWith('/') || file === 'docs-manifest.json') { continue; }
  add(file, fromGit(file), true);
}
// Upstream also ships this public starter. It remains a teaching asset, never
// the evaluated agent's initial implementation or an acceptance oracle.
const starterNames = ['package.json', 'AGENTS.md', 'playwright.config.mjs', 'workspace.browser.spec.mjs', 'gitignore',
  'index.html', 'main.ts', 'setup.ts', 'workspace.ts', 'workspace-views.ts', 'notes.ts', 'workspace.test.mjs',
  'readme.md', 'tsconfig.json', 'eslint.config.mjs', 'vite.config.mjs'];
for (const name of starterNames) {
  const source = `test/fixtures/data-package-starter/${name}`;
  const bytes = fromGit(source);
  if (name === 'package.json') {
    const pkg = JSON.parse(bytes);
    pkg.dependencies = { marionette: originalPackage.version, '@mnjs/data': originalPackage.version };
    pkg.allowScripts[`marionette@${originalPackage.version}`] = false;
    add(`starter/${name}`, Buffer.from(`${JSON.stringify(pkg, null, 2)}\n`));
  } else { add(`starter/${name}`, bytes); }
  originalHashes[source] = sha256(bytes);
}

// Both conditions use the exact revised freeze's reader and algorithm. Preserve
// the original hashes and disclose the common tooling overlay separately.
const toolingNormalization = [];
for (const name of ['docs.mjs', 'search.mjs', 'symbols.mjs']) {
  const source = `skills/marionette/scripts/${name}`;
  const bytes = await readFile(resolve(revisedFreeze, 'revised-package', source));
  toolingNormalization.push({ source, originalSha256: originalHashes[source], commonSha256: sha256(bytes) });
  files.set(source, bytes);
}
for (const source of selectedResources.filter(resource => resource.startsWith('skills/marionette/'))) {
  add(`dist/agent-skill/${source.slice('skills/marionette/'.length)}`, files.get(source));
}
const sections = selectedPages.flatMap(page => documentSections(page.source, files.get(page.source).toString('utf8')));
add('docs-sections.json', Buffer.from(`${JSON.stringify({ schemaVersion: 1, sections })}\n`));
let symbolValidation;
try {
  const index = symbolIndex(originalJson('config/api-contracts/inventory.json'), originalJson('config/api-contracts/semantics.json'), sections);
  validateSymbolIndex(index, new Set(sections.map(section => section.id)));
  add('docs-symbols.json', Buffer.from(`${JSON.stringify(index)}\n`));
  symbolValidation = { passed: true, exports: index.symbols.length, contracts: Object.keys(index.contracts).length };
} catch (error) {
  symbolValidation = { passed: false, reason: error.message, rule: 'Disable symbol mode in both conditions; do not repair historical prose or metadata.' };
}
const generatedAssets = ['docs-sections.json', ...symbolValidation.passed ? ['docs-symbols.json'] : []];
const pages = selectedPages.map(page => ({ ...page, sha256: sha256(files.get(page.source)) }));
const assets = [...selectedResources, ...generatedAssets].map(source => ({ source, sha256: sha256(files.get(source)) }));
const manifest = {
  schemaVersion: 1, packageName: originalPackage.name, packageVersion: originalPackage.version,
  channel: 'candidate', sourceRepository: 'https://github.com/marionettejs/marionette',
  sourceRevision: revision, sourceDirty: true,
  contentSha256: contentDigest([...pages, ...assets]), pages, assets,
  experimentalReconstruction: { publication: 'local frozen historical documentation; no registry/publication claim',
    runtime: 'not included; use the separately frozen current runtime', toolingNormalization },
};
add('docs-manifest.json', Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`));
add('package.json', Buffer.from(`${JSON.stringify({ ...originalPackage,
  files: [...new Set([...originalPackage.files, ...pages.map(page => page.source), ...assets.map(asset => asset.source), 'docs-manifest.json', 'starter/'])],
}, null, 2)}\n`));

const missingPaths = [];
const missingAnchors = [];
const excludedLinks = [];
const externalLinks = [];
let checkedLocalLinks = 0;
const anchors = markdown => {
  const seen = new Map();
  const ids = new Set();
  for (const token of marked.lexer(markdown)) {
    if (token.type !== 'heading') { continue; }
    const base = plainHeading(token.text).toLowerCase().replace(/[^\p{L}\p{N}_\-\s]/gu, '').replace(/\s/g, '-');
    const duplicate = seen.get(base) ?? 0;
    ids.add(duplicate ? `${base}-${duplicate}` : base);
    seen.set(base, duplicate + 1);
  }
  for (const match of markdown.matchAll(/\b(?:id|name)=["']([^"']+)["']/g)) { ids.add(match[1]); }
  return ids;
};
const maintenancePaths = new Set(navigation.filter(page => !isConsumerPage(page)).map(page => page.source));
const inspectLinks = (source, bytes) => {
  marked.walkTokens(marked.lexer(bytes.toString('utf8')), token => {
    if (token.type !== 'link' && token.type !== 'image') { return; }
    const href = token.href;
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/|\/)/i.test(href)) { externalLinks.push({ source, href }); return; }
    const [pathAndQuery, fragment] = href.split('#');
    const path = decodeURIComponent(pathAndQuery.split('?')[0]);
    const target = path ? posix.normalize(posix.join(posix.dirname(source), path)) : source;
    checkedLocalLinks++;
    if (!files.has(target)) {
      const item = { source, href, target };
      if (packageExcluded(target) || maintenancePaths.has(target)) { excludedLinks.push(item); } else { missingPaths.push(item); }
    } else if (fragment && /\.(?:md|txt)$/.test(target) && !anchors(files.get(target).toString('utf8')).has(decodeURIComponent(fragment))) {
      missingAnchors.push({ source, href, target });
    }
  });
};
for (const [source, bytes] of files) {
  if (/\.(?:md|txt)$/.test(source)) { inspectLinks(source, bytes); }
}
for (const [path, bytes] of files) {
  const destination = resolve(corpus, path);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, bytes);
  await chmod(destination, 0o444);
}
const report = {
  schemaVersion: 1, frozenAt: new Date().toISOString(), directory, corpusDirectory: corpus,
  sourceRevision: revision, originalSourceDirty: false, effectiveCorpusModified: true,
  publication: 'local historical reconstruction; never asserted to be published',
  contentSha256: manifest.contentSha256, pages: pages.length, assets: assets.length,
  selection: { consumerRule: 'navigation.section !== Maintaining Marionette',
    packageExclusionRules: ['benchmarks/', 'config/api-contracts/', 'scripts/api-contracts/', 'ROADMAP.md', 'test/unit/', 'test/README.md'],
    excludedPages: navigation.filter(page => !isConsumerPage(page)).map(page => page.source),
    excludedResources: resources.filter(packageExcluded), selectedResources,
    publicStarterFiles: starterNames.map(name => `starter/${name}`),
    privateReservedTasksRead: false, modelRuns: 0, runtimeBuilds: 0 },
  toolingNormalization, symbolValidation,
  commonGeneratorHashes: Object.fromEntries(await Promise.all(['scripts/docs/sections.mjs', 'scripts/docs/symbols.mjs'].map(async path =>
    [path, sha256(await readFile(resolve(root, path)))]))),
  originalSourceFileHashes: Object.fromEntries(Object.entries(originalHashes).sort(([a], [b]) => a.localeCompare(b))),
  corpusFileHashes: Object.fromEntries([...files].sort(([a], [b]) => a.localeCompare(b)).map(([path, bytes]) => [path, sha256(bytes)])),
  linkClosure: { checkedLocalLinks, missingPaths, excludedLinks, missingAnchors,
    externalLinks: externalLinks.length, externalAccess: 'not fetched; disable network during comparison',
    anchorCheck: 'GitHub-style heading approximation and explicit HTML ids; missing anchors require review',
    passedPaths: missingPaths.length === 0 && excludedLinks.length === 0 },
  limitations: ['Documentation-only reconstruction; package exports/runtime are not supplied by this tree.',
    'Historical prose and genuine public examples are unchanged; helper scripts use the common frozen treatment.',
    'All entrypoints and teaching assets are included in corpusFileHashes; contentSha256 follows the package manifest pages/assets convention.',
    'Historical task compatibility, sandbox isolation and acceptance execution are separate preflight requirements.'],
};
const freezeBytes = Buffer.from(`${JSON.stringify(report, null, 2)}\n`);
await writeFile(resolve(directory, 'freeze.json'), freezeBytes);
await chmod(resolve(directory, 'freeze.json'), 0o444);
const lookup = args => JSON.parse(execFileSync(process.execPath,
  [resolve(corpus, 'skills/marionette/scripts/docs.mjs'), '--package-root', corpus, ...args],
  { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }));
const listing = lookup(['--list']);
const search = lookup(['--search', 'retain shell during navigation']);
if (listing.pages.length !== pages.length || !search.results.length) { throw new Error('Frozen helper discovery failed.'); }
const helperVerification = { pages: listing.pages.length, searchResults: search.results.length,
  contentSha256: listing.contentSha256 };
if (symbolValidation.passed) {
  helperVerification.symbolMatches = lookup(['--symbol', 'Region.detachView']).matches.length;
  helperVerification.unknownSymbolMatches = lookup(['--symbol', 'UnknownExportName']).matches.length;
  if (!helperVerification.symbolMatches || helperVerification.unknownSymbolMatches) { throw new Error('Frozen helper symbol lookup failed.'); }
}
for (const [path, expected] of Object.entries(report.corpusFileHashes)) {
  if (sha256(await readFile(resolve(corpus, path))) !== expected) { throw new Error(`Frozen file hash mismatch: ${path}`); }
}
if (sha256(await readFile(resolve(directory, 'freeze.json'))) !== sha256(freezeBytes)) { throw new Error('Freeze manifest hash mismatch.'); }
const pointer = { schemaVersion: 1, sourceRevision: revision, directory, corpusDirectory: corpus,
  freezeManifest: resolve(directory, 'freeze.json'), freezeManifestSha256: sha256(freezeBytes),
  contentSha256: manifest.contentSha256, pages: pages.length, assets: assets.length,
  symbolValidation, toolingNormalization, linkClosure: report.linkClosure,
  verification: { corpusFilesVerified: files.size, freezeHashVerified: true, helper: helperVerification },
  preparationOnly: true, modelRuns: 0, runtimeBuilds: 0, privateReservedTasksRead: false };
await writeFile(resolve(root, 'planning/docs-v5/evidence/baseline-corpus-freeze-20260930.json'), `${JSON.stringify(pointer, null, 2)}\n`);
console.log(JSON.stringify(pointer, null, 2));
