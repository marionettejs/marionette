import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { resolvePerformanceTools } from '../../scripts/resolve-performance-tools.mjs';

const oldPaths = [
  'config/bundle-size.mjs',
  'config/performance-growth-approval.mjs',
  'benchmarks/performance.mjs',
];
const newPaths = [
  'scripts/performance/bundle-size.mjs',
  'scripts/performance/growth-approval.mjs',
  'scripts/performance/timing.mjs',
];

async function writePaths(root, paths) {
  for (const path of paths) {
    const file = join(root, path);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, '');
  }
}

test('resolves only one complete known performance-tool layout', async() => {
  const root = await mkdtemp(join(tmpdir(), 'marionette-performance-tools-'));

  try {
    await assert.rejects(
      resolvePerformanceTools(root),
      /config 0\/3; scripts 0\/3/
    );

    await writePaths(root, ['tools/bundle-size.mjs', 'tools/growth.mjs', 'tools/timing.mjs']);
    await assert.rejects(
      resolvePerformanceTools(root),
      /config 0\/3; scripts 0\/3/
    );

    await writePaths(root, oldPaths);
    assert.deepEqual(await resolvePerformanceTools(root), {
      bundleScript: join(root, oldPaths[0]),
      approvalScript: join(root, oldPaths[1]),
      timingScript: join(root, oldPaths[2]),
    });

    await rm(join(root, 'config'), { recursive: true });
    await rm(join(root, 'benchmarks'), { recursive: true });
    await writePaths(root, newPaths);
    assert.deepEqual(await resolvePerformanceTools(root), {
      bundleScript: join(root, newPaths[0]),
      approvalScript: join(root, newPaths[1]),
      timingScript: join(root, newPaths[2]),
    });

    await writePaths(root, [oldPaths[0]]);
    await assert.rejects(
      resolvePerformanceTools(root),
      /config 1\/3; scripts 3\/3/
    );
    await writePaths(root, oldPaths.slice(1));
    await assert.rejects(
      resolvePerformanceTools(root),
      /config 3\/3; scripts 3\/3/
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects every partial and mixed known layout', async() => {
  for (let mask = 1; mask < 63; mask += 1) {
    const selected = mask.toString(2).padStart(6, '0')
      .split('')
      .map(value => value === '1');
    const oldCount = selected.slice(0, 3).filter(Boolean).length;
    const newCount = selected.slice(3).filter(Boolean).length;
    if ((oldCount === 3 && newCount === 0) || (oldCount === 0 && newCount === 3)) {
      continue;
    }

    const root = await mkdtemp(join(tmpdir(), 'marionette-performance-tools-'));
    try {
      const paths = [
        ...oldPaths.filter((_, index) => selected[index]),
        ...newPaths.filter((_, index) => selected[index + 3]),
      ];
      await writePaths(root, paths);
      await assert.rejects(
        resolvePerformanceTools(root),
        new RegExp(`config ${oldCount}/3; scripts ${newCount}/3`)
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
});
