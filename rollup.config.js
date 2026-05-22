import babel from '@rollup/plugin-babel';
import eslint from '@rollup/plugin-eslint';
import json from '@rollup/plugin-json';
import { terser } from 'rollup-plugin-terser';

const globals = {
  underscore: '_',
};

const shimExternal = ['underscore', 'backbone', 'marionette'];
const shimMainExternal = {
  name: 'shim-main-external',
  resolveId(source, importer) {
    const normalizedImporter = importer && importer.replace(/\\/g, '/');

    // Keep the built shim pointed at the package entry instead of bundling Marionette.
    if (source === './index.js' && normalizedImporter && normalizedImporter.endsWith('/backbone.js')) {
      return { id: 'marionette', external: true };
    }

    return null;
  },
};

export default [
  {
    input: 'build/version.js',
    output: [
      {
        file: 'version.js',
        format: 'es',
      },
    ],
    plugins: [
      json(),
    ],
  },
  {
    input: 'index.js',
    external: ['underscore'],
    output: [
      {
        file: 'dist/marionette.umd.js',
        format: 'umd',
        name: 'Marionette',
        exports: 'named',
        sourcemap: true,
        globals,
      },
      {
        file: 'dist/marionette.js',
        format: 'es',
      },
      {
        file: 'dist/marionette.cjs',
        format: 'cjs',
        exports: 'named',
      },
    ],
    plugins: [
      eslint({ exclude: ['node_modules/**', './version.js'] }),
      babel({ babelHelpers: 'bundled' }),
    ]
  },
  {
    input: 'index.js',
    external: ['underscore'],
    output: [
      {
        file: 'dist/marionette.min.js',
        format: 'umd',
        name: 'Marionette',
        exports: 'named',
        sourcemap: true,
        globals,
      },
    ],
    plugins: [
      babel({ babelHelpers: 'bundled' }),
      terser(),
    ]
  },
  {
    input: 'backbone.js',
    external: shimExternal,
    output: [
      {
        file: 'dist/backbone.js',
        format: 'es',
      },
      {
        file: 'dist/backbone.cjs',
        format: 'cjs',
        exports: 'default',
      },
    ],
    plugins: [
      shimMainExternal,
      eslint({ exclude: ['node_modules/**', './version.js'] }),
      babel({ babelHelpers: 'bundled' }),
    ]
  },
]
