import { fileURLToPath } from 'node:url';
import compile from './build/babel.js';
import json from '@rollup/plugin-json';
import terser from '@rollup/plugin-terser';

const bundleUtils = {
  name: 'bundle-utils',
  resolveId(source) {
    if (source === '@marionette/utils') {
      return fileURLToPath(new URL('./packages/utils/src/index.ts', import.meta.url));
    }
  },
};

export default [
  {
    input: 'build/version.js',
    output: [
      {
        file: 'src/version.js',
        format: 'es',
      },
    ],
    plugins: [
      json(),
    ],
  },
  {
    input: 'src/index.ts',
    external: ['@marionette/utils'],
    output: [
      {
        file: 'dist/marionette.js',
        format: 'es',
      },
      {
        file: 'dist/marionette.cjs',
        format: 'cjs',
        esModule: true,
        exports: 'named',
      },
    ],
    plugins: [
      compile(),
    ]
  },
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/marionette.umd.js',
        format: 'umd',
        name: 'Marionette',
        exports: 'named',
        sourcemap: true,
      },
      {
        file: 'dist/marionette.min.js',
        format: 'umd',
        name: 'Marionette',
        exports: 'named',
        sourcemap: true,
        plugins: [terser()],
      },
    ],
    plugins: [
      bundleUtils,
      json(),
      compile(),
    ]
  },
]
