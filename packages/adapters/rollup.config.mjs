import babel from '@rollup/plugin-babel';

const babelOptions = {
  babelHelpers: 'bundled',
  shouldPrintComment: comment => comment.includes('@__PURE__') ||
    comment.includes('@license') || comment.includes('@preserve') || comment.startsWith('!')
};

export default [
  {
    input: 'src/backbone.js',
    output: [
      {
        file: 'dist/backbone.js',
        format: 'es'
      },
      {
        file: 'dist/backbone.cjs',
        format: 'cjs',
        exports: 'default'
      }
    ],
    plugins: [babel(babelOptions)]
  },
  {
    input: 'src/dom/jquery.js',
    external: ['jquery'],
    output: [
      {
        file: 'dist/dom/jquery.js',
        format: 'es'
      },
      {
        file: 'dist/dom/jquery.cjs',
        format: 'cjs',
        exports: 'default'
      }
    ],
    plugins: [babel(babelOptions)]
  },
  ...['redux', 'zustand', 'xstate-store'].map(name => ({
    input: `src/${ name }.js`,
    output: [
      {
        file: `dist/${ name }.js`,
        format: 'es'
      },
      {
        file: `dist/${ name }.cjs`,
        format: 'cjs',
        exports: 'default'
      }
    ],
    plugins: [babel(babelOptions)]
  }))
];
