import { execFileSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const fixturesDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(fixturesDir, '../..');
const packageInputs = [
  { name: 'marionette', flag: '--tarball', directory: '.' },
  { name: '@marionette/data', flag: '--data-tarball', directory: 'packages/data' },
  { name: '@marionette/adapters', flag: '--adapters-tarball', directory: 'packages/adapters' },
  { name: '@marionette/utils', flag: '--utils-tarball', directory: 'packages/utils' },
  { name: '@marionette/radio', flag: '--radio-tarball', directory: 'packages/radio' },
];
const adapterFixtures = new Set([
  'adapters-package-vite', 'backbone-adapter', 'backbone-adapter-types', 'cjs-adapters',
  'collection-removal-survivors', 'jquery-dom-api', 'jquery-dom-api-types',
  'xstate-adapter-types', 'dom-adapters-package',
]);

function readOptions(args) {
  const allowed = new Set(['--fixture', '--artifact-dir', '--report', ...packageInputs.map(input => input.flag)]);
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    if (!allowed.has(flag) || Object.hasOwn(options, flag)) {
      throw new Error(`Unknown or repeated option: ${flag}`);
    }
    if (!args[index + 1] || args[index + 1].startsWith('--')) {
      throw new Error(`Missing value for ${flag}`);
    }
    options[flag] = args[index + 1];
  }
  const supplied = packageInputs.filter(input => options[input.flag]);
  if (supplied.length && (supplied.length !== packageInputs.length || options['--artifact-dir'])) {
    throw new Error('Supply all five --*-tarball options, or --artifact-dir, or no artifacts to build locally.');
  }
  return options;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

// Compare package identities, not npm's incidental dev/peer flags. No registry
// package may be added, removed, relocated, or re-resolved by the candidate overlay.
function externalGraph(lock) {
  return Object.fromEntries(Object.entries(lock.packages).filter(([path]) =>
    path && !packageInputs.some(input => path === `node_modules/${input.name}`))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([path, entry]) => [path, {
      version: entry.version, resolved: entry.resolved, integrity: entry.integrity,
      dependencies: entry.dependencies, optionalDependencies: entry.optionalDependencies,
      peerDependencies: entry.peerDependencies,
    }]));
}

function selectedPackages(fixtureName) {
  const names = ['@marionette/utils', '@marionette/radio'];
  if (fixtureName !== 'standalone-packages') {
    names.push('marionette');
  }
  if (fixtureName === 'standalone-packages' || fixtureName === 'core-types' || fixtureName.startsWith('data-package-')) {
    names.push('@marionette/data');
  }
  if (fixtureName === 'core-types' || adapterFixtures.has(fixtureName)) {
    names.push('@marionette/adapters');
  }
  return names;
}

function assertIsolated(directory) {
  for (let ancestor = dirname(realpathSync(directory)); ; ancestor = dirname(ancestor)) {
    if (existsSync(resolve(ancestor, 'node_modules'))) {
      throw new Error(`Fixture ancestor contains node_modules: ${ancestor}`);
    }
    if (dirname(ancestor) === ancestor) {
      return;
    }
  }
}

const report = {
  schemaVersion: 1, id: randomUUID(), node: process.version,
  startedAt: new Date().toISOString(), artifacts: [], fixtures: [], status: 'failed',
};
let reportPath;
let workspace;
let stage = 'arguments';
try {
  const options = readOptions(process.argv.slice(2));
  const fixtures = readdirSync(fixturesDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && existsSync(resolve(fixturesDir, entry.name, 'package.json')))
    .map(entry => entry.name).sort();
  const inventory = readJson(resolve(rootDir, 'config/release-validation.json'));
  if (JSON.stringify(fixtures) !== JSON.stringify(inventory.fixtures.toSorted())) {
    throw new Error('Fixture directories do not match the release validation inventory.');
  }
  const selected = options['--fixture'] ? [options['--fixture']] : fixtures;
  if (!selected.length || selected.some(name => !fixtures.includes(name))) {
    throw new Error(`Unknown fixture: ${options['--fixture'] || '(none discovered)'}. Available: ${fixtures.join(', ')}`);
  }
  reportPath = resolve(rootDir, options['--report'] || `test/tmp/fixture-reports/${report.id}.json`);
  const npmCli = process.env.npm_execpath;
  if (!npmCli) {
    throw new Error('Run package fixtures through npm so the npm CLI can be located.');
  }
  const environment = {
    ...process.env,
    npm_config_fund: 'false', npm_config_audit: 'false', npm_config_package_lock: 'true',
    'npm_config_strict_allow_scripts': 'true',
    NODE_PATH: '',
    NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --no-global-search-paths`,
    // npm run adds the isolated fixture's .bin. Do not inherit the checkout's
    // npm-run PATH and accidentally validate against a missing local compiler.
    PATH: (process.env.PATH || '').split(delimiter).filter(path => !path.includes('node_modules')).join(delimiter),
  };
  function run(command, args, cwd = rootDir) {
    try {
      return execFileSync(command, args, { cwd, env: environment, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    } catch (error) {
      throw new Error(`${command} ${args.join(' ')} failed\n${error.stdout || ''}${error.stderr || error.message}`, { cause: error });
    }
  }
  function npm(args, cwd) {
    return run(process.execPath, [npmCli, ...args], cwd);
  }
  workspace = mkdtempSync(resolve(tmpdir(), 'marionette-fixtures-'));
  assertIsolated(workspace);
  const packDir = resolve(workspace, 'artifacts');
  mkdirSync(packDir);
  stage = 'artifacts';
  let paths;
  let evidence;
  if (options['--artifact-dir']) {
    const directory = resolve(rootDir, options['--artifact-dir']);
    paths = readdirSync(directory).filter(name => name.endsWith('.tgz')).map(name => resolve(directory, name));
    const evidencePath = resolve(directory, 'release-evidence.json');
    if (!existsSync(evidencePath)) {
      throw new Error('Artifact-directory mode requires release-evidence.json. Use explicit tarball arguments for local candidates.');
    }
    evidence = readJson(evidencePath);
    if (!Array.isArray(evidence.packages) || evidence.packages.length !== packageInputs.length) {
      throw new Error('Release evidence must describe all five package artifacts.');
    }
    report.evidence = { path: evidencePath, sha256: sha256(evidencePath), source: evidence.source };
  } else if (options['--tarball']) {
    paths = packageInputs.map(input => resolve(rootDir, options[input.flag]));
  } else {
    console.log('Building package candidates for fixtures...');
    npm(['run', 'build']);
    paths = packageInputs.map(input => {
      const result = JSON.parse(npm(['pack', '--json', '--ignore-scripts', '--pack-destination', packDir], resolve(rootDir, input.directory)));
      if (result.length !== 1) {
        throw new Error(`Expected one packed ${input.name} tarball, received ${result.length}`);
      }
      return resolve(packDir, result[0].filename);
    });
  }
  const artifacts = new Map();
  for (const [index, path] of paths.entries()) {
    // Freeze input before inspecting it; another task can replace the source.
    const frozenPath = resolve(packDir, `candidate-${index}.tgz`);
    cpSync(path, frozenPath);
    const manifest = JSON.parse(run('tar', ['-xOf', frozenPath, 'package/package.json']));
    if (!packageInputs.some(input => input.name === manifest.name) || artifacts.has(manifest.name)) {
      throw new Error(`Unexpected or duplicate artifact: ${manifest.name}`);
    }
    if (evidence) {
      const entry = evidence.packages.find(candidate => candidate.name === manifest.name);
      const bytes = readFileSync(frozenPath);
      if (!entry || entry.version !== manifest.version || entry.tarball?.file !== relative(resolve(rootDir, options['--artifact-dir']), path) ||
        entry.tarball.size !== bytes.length || entry.tarball.sha256 !== sha256(frozenPath) ||
        entry.tarball.sha512 !== createHash('sha512').update(bytes).digest('hex') ||
        entry.tarball.integrity !== `sha512-${createHash('sha512').update(bytes).digest('base64')}` ||
        JSON.stringify(entry.manifest) !== JSON.stringify(manifest)) {
        throw new Error(`Release evidence does not match package artifact: ${manifest.name}`);
      }
    }
    artifacts.set(manifest.name, frozenPath);
    report.artifacts.push({ name: manifest.name, version: manifest.version, source: path, sha256: sha256(frozenPath) });
  }
  if (artifacts.size !== packageInputs.length) {
    throw new Error(`Expected all five package artifacts; received ${artifacts.size}`);
  }
  report.npm = npm(['--version']).trim();
  // Snapshot documentation once so concurrent doc edits cannot change examples
  // midway through a matrix. Each fixture gets the same docs and relative paths.
  const docsSnapshot = resolve(workspace, 'docs');
  cpSync(resolve(rootDir, 'docs'), docsSnapshot, { recursive: true });
  for (const name of selected) {
    const started = Date.now();
    const result = { name, status: 'failed' };
    report.fixtures.push(result);
    const fixtureRoot = resolve(workspace, name);
    const fixtureDir = resolve(fixtureRoot, 'test/fixtures', name);
    try {
      stage = result.stage = 'copy';
      cpSync(resolve(fixturesDir, name), fixtureDir, {
        recursive: true,
        filter: source => !relative(resolve(fixturesDir, name), source).split(/[\\/]/).some(part => ['node_modules', 'dist'].includes(part)),
      });
      cpSync(docsSnapshot, resolve(fixtureRoot, 'docs'), { recursive: true });
      assertIsolated(fixtureDir);
      const lockPath = resolve(fixtureDir, 'package-lock.json');
      const lockedGraph = externalGraph(readJson(lockPath));
      result.lockSha256 = sha256(lockPath);
      stage = result.stage = 'candidate-lock';
      npm(['install', '--package-lock-only', '--ignore-scripts', '--save-exact',
        ...selectedPackages(name).map(packageName => artifacts.get(packageName))], fixtureDir);
      const candidateLock = readJson(lockPath);
      result.graph = externalGraph(candidateLock);
      if (JSON.stringify(result.graph) !== JSON.stringify(lockedGraph)) {
        throw new Error('Candidate installation changed the committed external dependency graph. Update the fixture lockfile explicitly.');
      }
      for (const packageName of selectedPackages(name)) {
        const entry = candidateLock.packages[`node_modules/${packageName}`];
        const expectedIntegrity = `sha512-${createHash('sha512').update(readFileSync(artifacts.get(packageName))).digest('base64')}`;
        if (entry?.integrity !== expectedIntegrity) {
          throw new Error(`Candidate lock does not reference exact artifact: ${packageName}`);
        }
      }
      result.candidateLockSha256 = sha256(lockPath);
      stage = result.stage = 'install';
      npm(['ci', '--ignore-scripts=false'], fixtureDir);
      stage = result.stage = 'installed-graph';
      result.installedGraph = JSON.parse(npm(['ls', '--all', '--json'], fixtureDir));
      stage = result.stage = 'validate';
      result.output = npm(['run', 'validate'], fixtureDir);
      result.status = 'passed';
      console.log(`PASS ${name} (${Date.now() - started}ms)`);
    } catch (error) {
      result.error = error.message;
      console.error(`Fixture ${name} failed at ${stage}: ${error.message}`);
    } finally {
      result.durationMs = Date.now() - started;
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  }
  report.status = report.fixtures.every(result => result.status === 'passed') ? 'passed' : 'failed';
  if (report.status === 'failed') {
    process.exitCode = 1;
  }
} catch (error) {
  report.error = error.message;
  report.stage = stage;
  console.error(error.message);
  process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  if (reportPath) {
    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`Fixture report: ${reportPath}`);
  }
  if (workspace) {
    rmSync(workspace, { recursive: true, force: true });
  }
}
