import { cp, mkdir, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { marked } from 'marked';
import { stagedCoreManifest } from '../release/packages.mjs';

async function contained(root, path) {
  const target = await realpath(resolve(root, path));
  const local = relative(await realpath(root), target);
  if (local === '..' || local.startsWith(`..${sep}`) || isAbsolute(local)) {
    throw new Error(`PACKAGED_DOC_LINK: target escapes root: ${path}`);
  }
  return stat(target);
}

export async function stagePackage(root, manifest) {
  const destination = resolve(root, '.package');
  await rm(destination, { recursive: true, force: true });
  await mkdir(destination, { recursive: true });
  const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  const entries = [...manifest.pages, ...manifest.assets];
  // Documentation is copied from the selected export, never whole source directories.
  for (const file of pkg.files) {
    if ((file.endsWith('/') && file !== 'dist/') || file === 'docs-manifest.json') { continue; }
    await cp(resolve(root, file), resolve(destination, file), { recursive: true });
  }
  for (const { source } of entries) {
    await contained(resolve(root, '.docs-export'), source);
    await mkdir(dirname(resolve(destination, source)), { recursive: true });
    await cp(resolve(root, '.docs-export', source), resolve(destination, source));
  }
  await writeFile(resolve(destination, 'package.json'), `${JSON.stringify(stagedCoreManifest(pkg, manifest), null, 2)}\n`);
  await writeFile(resolve(destination, 'docs-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  // Root guides keep their source bytes: links work in node_modules and on npmjs.com.
  for (const file of ['readme.md', 'upgradeGuide.md']) {
    const source = await readFile(resolve(destination, file), 'utf8');
    await Promise.all(marked.walkTokens(marked.lexer(source), async token => {
      if (token.type !== 'link' && token.type !== 'image') { return; }
      if (/^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(token.href)) { return; }
      const [path] = token.href.split(/[?#]/);
      await contained(destination, path).catch(cause => {
        throw new Error(`PACKAGED_DOC_LINK: ${file}: ${token.href} does not resolve`, { cause });
      });
    }));
  }
}
