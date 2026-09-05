import babel from '@rollup/plugin-babel';
import json from '@rollup/plugin-json';
import terser from '@rollup/plugin-terser';

const babelOptions = {
  babelHelpers: 'bundled',
  shouldPrintComment: comment => comment.includes('@__PURE__') ||
    comment.includes('@license') || comment.includes('@preserve') || comment.startsWith('!'),
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
    input: 'src/index.js',
    output: [
      {
        file: 'dist/marionette.umd.js',
        format: 'umd',
        name: 'Marionette',
        exports: 'named',
        sourcemap: true,
      },
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
      babel(babelOptions),
    ]
  },
  {
    input: 'src/index.js',
    output: [
      {
        file: 'dist/marionette.min.js',
        format: 'umd',
        name: 'Marionette',
        exports: 'named',
        sourcemap: true,
      },
    ],
    plugins: [
      babel(babelOptions),
      terser(),
    ]
  },
]
