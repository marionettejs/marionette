import { spawnSync } from 'child_process';

const result = spawnSync(
  'git',
  ['status', '--short', '--untracked-files=all', '--', 'dist', 'version.js'],
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

  const diff = spawnSync(
    'git',
    ['diff', '--no-ext-diff', '--unified=1', '--', 'dist', 'version.js'],
    { encoding: 'utf8', maxBuffer: 1024 * 1024 },
  );

  if (!diff.error && diff.stdout) {
    const diagnosticLimit = 20000;
    process.stderr.write(diff.stdout.slice(0, diagnosticLimit));

    if (diff.stdout.length > diagnosticLimit) {
      console.error('\nArtifact diff truncated after 20,000 characters.');
    }
  }

  console.error('Run `npm run build` and commit the resulting dist/ and version.js changes.');
  process.exit(1);
}
