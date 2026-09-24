import { cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { marked } from 'marked';

const entrypoints = ['readme.md', 'upgradeGuide.md'];

export async function stagePackage(root, manifest) {
  const destination = resolve(root, '.package');
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });
  const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  // Use the publication allowlist, not the repository or its installed dependencies.
  for (const file of ['package.json', ...pkg.files]) {
    await cp(resolve(root, file), resolve(destination, file), { recursive: true });
  }
  const bundled = new Set([...manifest.pages, ...manifest.assets].map(page => page.source));
  const rootFiles = new Set(pkg.files.filter(file => !file.endsWith('/')));
  for (const file of entrypoints) {
    const source = await readFile(resolve(root, file), 'utf8');
    const replacements = new Map();
    const code = [];
    const sourceChecks = [];
    await Promise.all(marked.walkTokens(marked.lexer(source), token => {
      if (token.type === 'code' || token.type === 'codespan') { code.push(token.raw); }
      if (token.type !== 'link' && token.type !== 'image') { return; }
      const href = token.href;
      if (/^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(href)) { return; }
      const [path] = href.split(/[?#]/);
      if (rootFiles.has(path)) { return; }
      const target = bundled.has(path) ? `dist/docs/${href}` :
        `${manifest.sourceRepository}/blob/${manifest.sourceRevision}/${href}`;
      if (!bundled.has(path)) { sourceChecks.push(stat(resolve(root, path))); }
      replacements.set(href, target);
    }));
    await Promise.all(sourceChecks);
    // Rewrite inline destinations and reference definitions, leaving code examples intact.
    let rewritten = source;
    for (const [index, raw] of code.entries()) {
      rewritten = rewritten.replaceAll(raw, `\0CODE${index}\0`);
    }
    rewritten = rewritten.replace(
      /(\]\(\s*<?)([^\s)>]+)|(^ {0,3}\[[^\]\n]+\]:\s*<?)([^\s>]+)/gm,
      (match, opening, href, definition, reference) => opening ?
        `${opening}${replacements.get(href) || href}` :
        `${definition}${replacements.get(reference) || reference}`
    );
    for (const [index, raw] of code.entries()) {
      rewritten = rewritten.replaceAll(`\0CODE${index}\0`, () => raw);
    }
    const checks = [];
    await Promise.all(marked.walkTokens(marked.lexer(rewritten), token => {
      if (token.type !== 'link' && token.type !== 'image') { return; }
      if (/^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(token.href)) { return; }
      const [path] = token.href.split(/[?#]/);
      checks.push(stat(resolve(destination, path)).catch(cause => {
        throw new Error(`PACKAGED_DOC_LINK: ${file}: ${token.href} does not resolve`, { cause });
      }));
    }));
    await Promise.all(checks);
    await writeFile(resolve(destination, file), rewritten);
  }
}
