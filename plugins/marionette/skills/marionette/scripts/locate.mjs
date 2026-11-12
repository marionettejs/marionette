import { readFile, realpath, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

const companionDocs = {
  '@mnjs/html': ['guide.md', 'LIT_DIFFERENCES.md'],
  '@mnjs/router': ['readme.md', 'DESIGN.md'],
};

async function findCompanions(project) {
  const require = createRequire(resolve(project, 'package.json'));
  const companions = [];
  for (const [name, files] of Object.entries(companionDocs)) {
    try {
      let manifestPath;
      try {
        manifestPath = await realpath(require.resolve(`${name}/package.json`));
      } catch (error) {
        if (error.code === 'MODULE_NOT_FOUND') { continue; }
        if (error.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED') {
          companions.push({ packageName: name, guidance: 'This installed package does not export package.json. Use your package manager to locate its installed directory, then read package.json and the documented Markdown files directly; do not import its runtime or use the core-only --package-root option.' });
          continue;
        }
        throw error;
      }
      const packageRoot = dirname(manifestPath);
      const metadata = JSON.parse(await readFile(manifestPath, 'utf8'));
      if (metadata.name !== name) { throw new Error(`Expected ${name} package metadata.`); }
      const documentation = [];
      const missingDocumentation = [];
      for (const file of files) {
        try {
          const path = await realpath(resolve(packageRoot, file));
          const local = relative(packageRoot, path);
          if (local === '..' || local.startsWith(`..${sep}`) || isAbsolute(local)) {
            throw new Error(`Documentation escapes package root: ${file}`);
          }
          if (!(await stat(path)).isFile()) { throw new Error(`Documentation is not a file: ${file}`); }
          documentation.push(path);
        } catch (error) {
          if (error.code !== 'ENOENT') { throw error; }
          missingDocumentation.push(file);
        }
      }
      companions.push({ packageName: name, packageVersion: metadata.version, packageRoot,
        documentation, missingDocumentation });
    } catch (error) {
      companions.push({ packageName: name,
        guidance: 'Companion documentation lookup failed. Inspect this installed package before using its guidance; core and other companion results remain available.',
        error: error.message });
    }
  }
  return companions;
}

const usage = 'Usage: node locate.mjs [--project DIRECTORY | --package-root DIRECTORY]';
async function main() {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || !['--project', '--package-root'].includes(args[0]) || args[1].startsWith('--'))) {
    throw new Error(usage);
  }
  const root = await realpath(args[1] ?? process.cwd());
  if (!(await stat(root)).isDirectory()) { throw new Error(usage); }
  const paths = [];
  if (args[0] === '--package-root') {
    paths.push(resolve(root, 'package.json'));
  } else {
    const require = createRequire(resolve(root, 'package.json'));
    for (const name of ['marionette', 'backbone.marionette']) {
      try { paths.push(require.resolve(`${name}/package.json`)); } catch (error) {
        if (error.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED') {
          throw new Error(`${name} does not export package.json. Use --package-root with its physical package directory.`, { cause: error });
        }
        if (error.code !== 'MODULE_NOT_FOUND') { throw error; }
      }
    }
  }
  const packages = await Promise.all(paths.map(async path => {
    const packageRoot = dirname(await realpath(path));
    const metadata = JSON.parse(await readFile(path, 'utf8'));
    if (!['marionette', 'backbone.marionette'].includes(metadata.name)) {
      throw new Error('Package root must identify marionette or backbone.marionette.');
    }
    const result = { packageName: metadata.name, packageVersion: metadata.version, packageRoot };
    if (metadata.name === 'backbone.marionette') {
      const guidance = metadata.version.startsWith('4.') ?
        'Use the installed v4 contracts. For migration, choose an exact v5 target and read its packaged migration guide.' :
        `Use documentation for backbone.marionette ${metadata.version}; the v4-to-v5 guide does not cover this release.`;
      return { ...result, guidance };
    }
    const skillPath = resolve(packageRoot, 'skills/marionette/SKILL.md');
    try {
      if (!(await stat(skillPath)).isFile()) { throw new Error('Installed skill is not a file.'); }
      return { ...result, skillPath };
    } catch (error) {
      if (error.code !== 'ENOENT') { throw error; }
      return { ...result, guidance: 'No packaged skill at skills/marionette/SKILL.md. Read this release’s documentation or obtain its exact source revision; do not substitute current repository instructions.' };
    }
  }));
  const companionPackages = args[0] === '--package-root' ? [] : await findCompanions(root);
  console.log(JSON.stringify({ packages, companionPackages, ...!packages.length && {
    guidance: 'No installed Marionette package found. Use the application directory or --package-root; for a new application choose an exact release first.',
  } }, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
