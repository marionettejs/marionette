import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, lstat, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const digest = bytes => createHash('sha512').update(bytes).digest('hex');
const readRegularFile = async path => {
  if (!(await lstat(path)).isFile()) { throw new Error(`Development starter requires a regular file: ${path}`); }
  return readFile(path);
};
const readJson = async path => JSON.parse((await readRegularFile(path)).toString());
const externalGraph = (lock, names) => Object.fromEntries(Object.entries(lock.packages)
  .filter(([path]) => path && !names.some(name => path === `node_modules/${name}`))
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([path, entry]) => [path, {
    version: entry.version, resolved: entry.resolved, integrity: entry.integrity,
    dependencies: entry.dependencies, optionalDependencies: entry.optionalDependencies,
    peerDependencies: entry.peerDependencies
  }]));

// A portable consumer project beside its exact tarballs. This never publishes.
export async function buildDevelopmentKit({ source, toolingLock, artifactDir, packages, sourceCommit, npmCli }) {
  const destination = resolve(artifactDir, 'starter');
  await cp(source, destination, { recursive: true, errorOnExist: true, force: false });
  const manifestPath = resolve(destination, 'package.json');
  const lockPath = resolve(destination, 'package-lock.json');
  const manifest = await readJson(manifestPath);
  const names = packages.map(entry => entry.name);
  await cp(toolingLock, lockPath);
  const before = externalGraph(await readJson(lockPath), names);
  manifest.dependencies = Object.fromEntries(packages.map(entry => [entry.name, `file:../${entry.tarball.file}`]));
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  await execute(process.execPath, [npmCli, 'install', '--package-lock-only', '--ignore-scripts'], {
    cwd: destination, timeout: 60_000, maxBuffer: 1024 * 1024,
    env: { ...process.env, npm_config_audit: 'false', npm_config_fund: 'false' }
  });
  const lock = await readJson(lockPath);
  if (JSON.stringify(before) !== JSON.stringify(externalGraph(lock, names))) {
    throw new Error('Development kit changed the locked external dependency graph.');
  }
  for (const entry of packages) {
    if (typeof entry.tarball.integrity !== 'string' || !entry.tarball.integrity ||
        lock.packages[`node_modules/${entry.name}`]?.integrity !== entry.tarball.integrity) {
      throw new Error(`Development kit does not lock the selected ${entry.name} tarball.`);
    }
  }
  const files = {};
  for (const file of (await readdir(destination)).sort()) {
    files[file] = digest(await readRegularFile(resolve(destination, file)));
  }
  const report = { sourceCommit, files };
  const bytes = `${JSON.stringify(report, null, 2)}\n`;
  await writeFile(resolve(artifactDir, 'development-starter.json'), bytes);
  await writeFile(resolve(artifactDir, 'START-HERE.md'), `# Develop against this candidate

Source: ${sourceCommit}. These tarballs are a development candidate, not a new npm release.
Keep the five tarballs beside the starter directory. From this extracted artifact:

\`\`\`sh
cd starter
mv gitignore .gitignore
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm run browser:install
npm run test:browser
npm run dev
\`\`\`

Use the Node/npm profile in release-evidence.json. The starter lockfile selects these
exact local tarballs, including their integrity hashes, with no npm version lookup
for Marionette packages. The documentation in node_modules/marionette/dist/docs
belongs to this same source. Start with docs/development.md and docs/troubleshooting.md.
Validation status is recorded in candidate-validation.json when certification finishes.
`);
  await execute('tar', ['-czf', resolve(artifactDir, 'development-starter.tar.gz'), '-C', artifactDir,
    'starter', 'development-starter.json', 'START-HERE.md']);
  return { file: 'development-starter.json', sha512: digest(bytes), archive: {
    file: 'development-starter.tar.gz', sha512: digest(await readFile(resolve(artifactDir, 'development-starter.tar.gz')))
  } };

}

export async function verifyDevelopmentKit(artifactDir, report, sourceCommit) {
  if (report?.file !== 'development-starter.json') { throw new Error('Missing development starter report.'); }
  if (report.archive?.file !== 'development-starter.tar.gz' ||
      digest(await readRegularFile(resolve(artifactDir, report.archive.file))) !== report.archive.sha512) {
    throw new Error('Development starter archive checksum mismatch.');
  }
  const bytes = await readRegularFile(resolve(artifactDir, report.file));
  if (digest(bytes) !== report.sha512) { throw new Error('Development starter report checksum mismatch.'); }
  const kit = JSON.parse(bytes);
  if (kit.sourceCommit !== sourceCommit || !kit.files || !Object.hasOwn(kit.files, 'package-lock.json')) {
    throw new Error('Development starter source or inventory mismatch.');
  }
  const directory = resolve(artifactDir, 'starter');
  if (!(await lstat(directory)).isDirectory()) { throw new Error('Development starter requires a real directory.'); }
  if (JSON.stringify((await readdir(directory)).sort()) !== JSON.stringify(Object.keys(kit.files).sort())) {
    throw new Error('Development starter file inventory mismatch.');
  }
  for (const [file, expected] of Object.entries(kit.files)) {
    if (!/^[a-zA-Z0-9._-]+$/.test(file) || file === '.' || file === '..' ||
        digest(await readRegularFile(resolve(directory, file))) !== expected) {
      throw new Error(`Development starter file mismatch: ${file}`);
    }
  }
}
