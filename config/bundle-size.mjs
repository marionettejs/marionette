import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import { brotliCompress, constants } from 'node:zlib';

const compress = promisify(brotliCompress);
const args = process.argv.slice(2);

function getArgument(name, fallback) {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1];
}

function formatBytes(bytes) {
  if (Math.abs(bytes) < 1000) {
    return `${bytes} B`;
  }

  return `${(bytes / 1000).toFixed(2)} kB`;
}

function formatChange(base, current) {
  const difference = current - base;
  const prefix = difference > 0 ? '+' : '';
  const percent = base === 0 ? 100 : (difference / base) * 100;
  const indicator = difference > 0 ? ' 🔺' : difference < 0 ? ' 🔽' : '';

  return `${prefix}${formatBytes(difference)} (${prefix}${percent.toFixed(2)}%)${indicator}`;
}

function parseLimit(limit) {
  const match = /^(\d+) B$/.exec(limit);
  if (!match) {
    throw new Error(`Unsupported size limit: ${limit}`);
  }

  return Number(match[1]);
}

async function readJson(file) {
  return JSON.parse(await readFile(resolve(file), 'utf8'));
}

async function createReport(baseFile, currentFile) {
  const base = await readJson(baseFile);
  const current = await readJson(currentFile);
  const baseByPath = new Map(base.map(result => [result.path, result]));
  const rows = current.map(result => {
    const baseResult = baseByPath.get(result.path);
    if (!baseResult) {
      throw new Error(`No base result for ${result.path}`);
    }

    return `| ${result.name} | ${formatBytes(baseResult.size)} | ${formatBytes(result.size)} | ${formatChange(baseResult.size, result.size)} | ${formatBytes(result.limit)} |`;
  });

  console.log([
    '<!-- bundle-size-report -->',
    '## Bundle size report 📦',
    '',
    '| Bundle | Base | PR | Change | Limit |',
    '| --- | ---: | ---: | ---: | ---: |',
    ...rows,
    '',
    'Sizes are Brotli-compressed with quality 11.'
  ].join('\n'));
}

async function measure() {
  const root = resolve(getArgument('--root', '.'));
  const config = await readJson(getArgument('--config', 'config/bundle-size.json'));
  const results = await Promise.all(config.map(async check => {
    const contents = await readFile(resolve(root, check.path));
    const compressed = await compress(contents, {
      params: {
        [constants.BROTLI_PARAM_QUALITY]: 11
      }
    });

    return {
      name: check.name,
      path: check.path,
      size: compressed.length,
      limit: parseLimit(check.limit)
    };
  }));

  if (args.includes('--json')) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    for (const result of results) {
      const remaining = result.limit - result.size;
      let status;
      if (remaining >= 0) {
        status = `${formatBytes(remaining)} remaining`;
      } else {
        status = `${formatBytes(Math.abs(remaining))} over limit`;
      }
      console.log(`${result.name}: ${formatBytes(result.size)} / ${formatBytes(result.limit)} (${status})`);
    }
  }

  if (!args.includes('--no-enforce') && results.some(result => result.size > result.limit)) {
    process.exitCode = 1;
  }
}

async function main() {
  const reportIndex = args.indexOf('--report');
  if (reportIndex === -1) {
    await measure();
  } else {
    await createReport(args[reportIndex + 1], args[reportIndex + 2]);
  }
}

main();
