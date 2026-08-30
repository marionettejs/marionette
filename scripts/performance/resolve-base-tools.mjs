import { stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const layouts = [
  {
    name: 'config',
    authority: 'config/bundle-size.mjs',
    approval: 'config/performance-growth-approval.mjs',
  },
  {
    name: 'scripts',
    authority: 'scripts/performance/bundle-size.mjs',
    approval: 'scripts/performance/growth-approval.mjs',
  },
];

async function isFile(path) {
  try {
    return (await stat(path)).isFile();
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

// Transitional for issue #237. Remove after every supported exact base uses scripts/performance.
export async function resolveBasePerformanceTools(root) {
  const results = await Promise.all(layouts.map(async layout => {
    const paths = [layout.authority, layout.approval].map(path => join(root, path));
    const present = await Promise.all(paths.map(isFile));
    return { layout, paths, present };
  }));
  const complete = results.filter(result => result.present.every(Boolean));
  const presentFiles = results.reduce((count, result) => {
    return count + result.present.filter(Boolean).length;
  }, 0);

  if (complete.length !== 1 || presentFiles !== 2) {
    const summary = results
      .map(({ layout, present }) => `${layout.name} ${present.filter(Boolean).length}/2`)
      .join('; ');
    throw new Error(`Expected exactly one complete exact-base performance-tool layout; ${summary}`);
  }

  return {
    authorityScript: complete[0].paths[0],
    approvalScript: complete[0].paths[1],
  };
}

async function main(args = process.argv.slice(2)) {
  if (args.length !== 2 || args[0] !== '--root') {
    throw new Error('Usage: resolve-base-tools.mjs --root <exact-base-checkout>');
  }
  const tools = await resolveBasePerformanceTools(args[1]);
  process.stdout.write(`${tools.authorityScript}\t${tools.approvalScript}\n`);
}

const entryUrl = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (entryUrl === import.meta.url) {
  await main();
}
