import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';
import terser from '@rollup/plugin-terser';
import { rollup } from 'rollup';

const root = fileURLToPath(new URL('../..', import.meta.url));
const inputId = '\0view-list-consumer';
const applicationMarkers = [
  'ApplicationError',
  'A child Application must be an Application instance.',
  'A child Application cannot be an ancestor of its owner.',
];
const formats = ['es', 'cjs', 'umd'];

async function buildConsumer(format) {
  const bundle = await rollup({
    input: inputId,
    plugins: [
      {
        name: 'view-list-consumer',
        resolveId(source) {
          if (source === inputId) { return inputId; }
          if (source === 'marionette') { return resolve(root, 'dist/marionette.js'); }
        },
        load(id) {
          if (id === inputId) {
            return 'export { CollectionView, MnObject, View } from \'marionette\';';
          }
        },
      },
      terser({
        compress: { passes: 2 },
        format: { comments: false },
        mangle: true,
      }),
    ],
    treeshake: true,
  });

  try {
    const generated = await bundle.generate({
      exports: 'named',
      format,
      name: format === 'umd' ? 'MarionetteViewList' : undefined,
    });
    return generated.output.map(({ code }) => code).filter(Boolean).join('\n');
  } finally {
    await bundle.close();
  }
}

describe('Application tree shaking', () => {
  test('removes unused Application code from a named View/list consumer', async() => {
    for (const format of formats) {
      const code = await buildConsumer(format);
      for (const marker of applicationMarkers) {
        assert.ok(!code.includes(marker), `${format} retains ${marker}`);
      }
      for (const exportedName of ['CollectionView', 'MnObject', 'View']) {
        assert.ok(code.includes(exportedName), `${format} omits ${exportedName}`);
      }
    }
  });
});
