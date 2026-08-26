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
  console.error('Run `npm run build` and commit the resulting dist/ and version.js changes.');
  process.exit(1);
}
