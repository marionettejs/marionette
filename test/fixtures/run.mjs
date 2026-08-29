import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '../..');
const packDir = resolve(rootDir, 'test/tmp/pack-fixtures');
const npmCli = process.env.npm_execpath;
const cliArgs = process.argv.slice(2);
const fixtures = readdirSync(__dirname, { withFileTypes: true })
  .filter(entry => entry.isDirectory() &&
    existsSync(resolve(__dirname, entry.name, 'package.json')))
  .map(entry => entry.name)
  .sort();

if (fixtures.length === 0) {
  throw new Error('No packed-package fixtures discovered under test/fixtures');
}

function run(command, args, options = {}) {
  execFileSync(command, args, {
    cwd: options.cwd || rootDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      npm_config_fund: 'false',
      npm_config_audit: 'false',
      npm_config_package_lock: 'false',
    },
  });
}

function runNpm(args, options) {
  if (!npmCli) {
    throw new Error('Run package fixtures through npm so the npm CLI can be located.');
  }

  run(process.execPath, [npmCli, ...args], options);
}

function readArgument(name) {
  const index = cliArgs.indexOf(name);
  if (index === -1) {
    return undefined;
  }

  const value = cliArgs[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${name}`);
  }

  return value;
}

function cleanFixture(fixtureDir) {
  rmSync(resolve(fixtureDir, 'dist'), { force: true, recursive: true });
  rmSync(resolve(fixtureDir, 'node_modules'), { force: true, recursive: true });
  rmSync(resolve(fixtureDir, 'package-lock.json'), { force: true });
}

rmSync(packDir, { force: true, recursive: true });
mkdirSync(packDir, { recursive: true });

try {
  const suppliedTarball = readArgument('--tarball');
  let tarballPath;
  if (suppliedTarball) {
    tarballPath = resolve(rootDir, suppliedTarball);
    if (!existsSync(tarballPath)) {
      throw new Error(`Packed tarball does not exist: ${tarballPath}`);
    }
  } else {
    runNpm(['pack', '--pack-destination', packDir]);

    const packedTarballs = readdirSync(packDir)
      .filter(fileName => fileName.endsWith('.tgz'));

    if (packedTarballs.length !== 1) {
      throw new Error(`Expected one packed tarball, found ${packedTarballs.length}`);
    }

    tarballPath = resolve(packDir, packedTarballs[0]);
  }

  for (const fixtureName of fixtures) {
    const fixtureDir = resolve(__dirname, fixtureName);

    if (!existsSync(resolve(fixtureDir, 'package.json'))) {
      throw new Error(`Fixture is missing package.json: ${fixtureName}`);
    }

    cleanFixture(fixtureDir);
    try {
      runNpm(['install'], { cwd: fixtureDir });
      runNpm(['install', '--no-save', tarballPath], { cwd: fixtureDir });
      runNpm(['run', 'validate'], { cwd: fixtureDir });
    } finally {
      cleanFixture(fixtureDir);
    }
  }
} finally {
  rmSync(packDir, { force: true, recursive: true });
}
