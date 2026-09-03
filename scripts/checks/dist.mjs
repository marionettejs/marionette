import { spawnSync } from 'child_process';
import { devNull } from 'os';

const result = spawnSync(
  'git',
  ['status', '--short', '--untracked-files=all', '--', 'dist', 'packages/adapters/dist', 'packages/data/dist', 'version.js'],
  { encoding: 'utf8' },
);

if (result.error) {
  throw result.error;
}

if (result.status !== 0) {
  process.stderr.write(result.stderr);
  process.exit(result.status);
}

if (result.stdout) {
  console.error('Generated distributable artifacts are out of date:');
  process.stderr.write(result.stdout);

  const trackedDiff = spawnSync(
    'git',
    ['diff', '--no-ext-diff', '--unified=1', 'HEAD', '--', 'dist', 'packages/adapters/dist', 'packages/data/dist', 'version.js'],
    { encoding: 'utf8', maxBuffer: 1024 * 1024 },
  );

  let diagnostic = trackedDiff.error ? '' : trackedDiff.stdout;
  const untracked = spawnSync(
    'git',
    ['ls-files', '--others', '--exclude-standard', '-z', '--', 'dist', 'packages/adapters/dist', 'packages/data/dist', 'version.js'],
    { encoding: 'utf8' },
  );

  if (!untracked.error && untracked.stdout) {
    for (const file of untracked.stdout.split('\0').filter(Boolean)) {
      const untrackedDiff = spawnSync(
        'git',
        ['diff', '--no-index', '--no-ext-diff', '--unified=1', '--', devNull, file],
        { encoding: 'utf8', maxBuffer: 1024 * 1024 },
      );

      if (!untrackedDiff.error && untrackedDiff.stdout) {
        diagnostic += untrackedDiff.stdout;
      }
    }
  }

  if (diagnostic) {
    const diagnosticLimit = 20000;
    process.stderr.write(diagnostic.slice(0, diagnosticLimit));

    if (diagnostic.length > diagnosticLimit) {
      console.error('\nArtifact diff truncated after 20,000 characters.');
    }
  }

  console.error('Run `npm run build` and commit the resulting dist files and version.js changes.');
  process.exit(1);
}
