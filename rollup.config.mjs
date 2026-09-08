import { fileURLToPath } from 'node:url';
import compile from './build/babel.js';
import json from '@rollup/plugin-json';
import terser from '@rollup/plugin-terser';

const bundlePackages = {
  name: 'bundle-packages',
  resolveId(source) {
    if (['@mnjs/utils', '@mnjs/radio'].includes(source)) {
      return fileURLToPath(new URL(`./packages/${source.split('/')[1]}/src/index.ts`, import.meta.url));
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
    external: ['@mnjs/utils', '@mnjs/radio'],
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
      bundlePackages,
      json(),
      compile(),
    ]
  },
]
