import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '../..');
const packDir = resolve(rootDir, 'test/tmp/pack-fixtures');
const fixtures = [
  'cjs-node',
  'esm-node',
  'no-default-export',
  'shim',
  'jquery-dom-api',
  'vite',
  'peer-underscore-min',
];

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

function cleanFixture(fixtureDir) {
  rmSync(resolve(fixtureDir, 'dist'), { force: true, recursive: true });
  rmSync(resolve(fixtureDir, 'node_modules'), { force: true, recursive: true });
  rmSync(resolve(fixtureDir, 'package-lock.json'), { force: true });
}

rmSync(packDir, { force: true, recursive: true });
mkdirSync(packDir, { recursive: true });

try {
  run('npm', ['run', 'build']);
  run('npm', ['pack', '--pack-destination', packDir]);

  const packedTarballs = readdirSync(packDir)
    .filter(fileName => fileName.endsWith('.tgz'));

  if (packedTarballs.length !== 1) {
    throw new Error(`Expected one packed tarball, found ${packedTarballs.length}`);
  }

  const tarballPath = resolve(packDir, packedTarballs[0]);

  for (const fixtureName of fixtures) {
    const fixtureDir = resolve(__dirname, fixtureName);

    if (!existsSync(resolve(fixtureDir, 'package.json'))) {
      throw new Error(`Fixture is missing package.json: ${fixtureName}`);
    }

    cleanFixture(fixtureDir);
    try {
      run('npm', ['install'], { cwd: fixtureDir });
      run('npm', ['install', '--no-save', tarballPath], { cwd: fixtureDir });
      run('npm', ['run', 'validate'], { cwd: fixtureDir });
    } finally {
      cleanFixture(fixtureDir);
    }
  }
} finally {
  rmSync(packDir, { force: true, recursive: true });
}
