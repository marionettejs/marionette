import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const packages = [
  { id: 'utils', name: '@marionette/utils', directory: 'packages/utils' },
  { id: 'radio', name: '@marionette/radio', directory: 'packages/radio' },
  { id: 'core', name: 'marionette', directory: '.' },
  { id: 'data', name: '@marionette/data', directory: 'packages/data' },
  { id: 'adapters', name: '@marionette/adapters', directory: 'packages/adapters' }
];

export default async function setup() {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'marionette-browser-'));
  const cleanup = () => rm(temporaryDirectory, { recursive: true, force: true });
  try {
    let evidence;
    let artifactDirectory;
    const manifestFile = process.env.MARIONETTE_BROWSER_ARTIFACT_MANIFEST;
    if (manifestFile) {
      artifactDirectory = dirname(resolve(manifestFile));
      evidence = JSON.parse(await readFile(resolve(manifestFile), 'utf8'));
      if (evidence.schemaVersion !== 2 || !Array.isArray(evidence.packages) ||
          evidence.packages.length !== packages.length) {
        throw new Error('Browser tests require a schema 2 release manifest containing all five packages.');
      }
    } else {
      artifactDirectory = join(temporaryDirectory, 'pack');
      await mkdir(artifactDirectory);
      const npmCli = process.env.npm_execpath;
      if (!npmCli) {
        throw new Error('Run browser tests through npm, or supply MARIONETTE_BROWSER_ARTIFACT_MANIFEST.');
      }
      evidence = { schemaVersion: 2, packages: [] };
      for (const configuration of packages) {
        const packed = JSON.parse(execFileSync(process.execPath, [
          npmCli, 'pack', resolve(root, configuration.directory), '--ignore-scripts',
          '--json', '--pack-destination', artifactDirectory
        ], { cwd: root, encoding: 'utf8' }));
        if (packed.length !== 1 || packed[0].name !== configuration.name) {
          throw new Error(`Expected one packed ${configuration.name} artifact.`);
        }
        const bytes = await readFile(join(artifactDirectory, packed[0].filename));
        evidence.packages.push({
          id: configuration.id,
          name: configuration.name,
          version: packed[0].version,
          tarball: {
            file: packed[0].filename,
            size: bytes.length,
            sha512: createHash('sha512').update(bytes).digest('hex'),
            integrity: packed[0].integrity
          }
        });
      }
    }

    const candidate = { source: evidence.source || null, packages: [] };
    for (const configuration of packages) {
      const matches = evidence.packages.filter(entry => entry.id === configuration.id);
      const entry = matches[0];
      if (matches.length !== 1 || entry.name !== configuration.name ||
          entry.version !== evidence.packages[0].version ||
          (evidence.release && entry.version !== evidence.release.version)) {
        throw new Error(`Invalid browser artifact identity for ${configuration.name}.`);
      }
      const filename = entry.tarball?.file;
      if (!filename || filename !== basename(filename) || /[\\/]/.test(filename)) {
        throw new Error(`Browser artifact must be a tarball filename: ${filename}.`);
      }
      const tarball = join(artifactDirectory, filename);
      const bytes = await readFile(tarball);
      const sha512 = createHash('sha512').update(bytes).digest('hex');
      const integrity = `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
      if (sha512 !== entry.tarball.sha512 || integrity !== entry.tarball.integrity ||
          bytes.length !== entry.tarball.size) {
        throw new Error(`Browser artifact integrity mismatch for ${configuration.name}.`);
      }
      const extraction = join(temporaryDirectory, configuration.id);
      await mkdir(extraction);
      execFileSync('tar', ['-xzf', tarball, '-C', extraction]);
      const directory = join(extraction, 'package');
      const manifest = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
      if (manifest.name !== entry.name || manifest.version !== entry.version) {
        throw new Error(`Packed browser package identity mismatch for ${configuration.name}.`);
      }
      candidate.packages.push({ ...entry, directory, manifest });
    }
    const candidateFile = join(temporaryDirectory, 'candidate.json');
    await writeFile(candidateFile, JSON.stringify(candidate));
    process.env.MARIONETTE_BROWSER_CANDIDATE = candidateFile;
    const reportDirectory = resolve(root, 'test/tmp/browser');
    await mkdir(reportDirectory, { recursive: true });
    // Persist exact hashes next to the reports after the temporary packages go away.
    await writeFile(join(reportDirectory, 'candidate.json'), JSON.stringify({
      source: candidate.source,
      packages: candidate.packages.map(({ directory, manifest, ...entry }) => entry)
    }, null, 2));
    return cleanup;
  } catch (error) {
    await cleanup();
    throw error;
  }
}
