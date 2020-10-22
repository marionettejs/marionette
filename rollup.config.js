import babel from '@rollup/plugin-babel';
import eslint from '@rollup/plugin-eslint';
import json from '@rollup/plugin-json';
import { terser } from 'rollup-plugin-terser';

const globals = {
  underscore: '_',
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
]
