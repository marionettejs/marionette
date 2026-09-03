import babel from '@rollup/plugin-babel';

const babelOptions = {
  babelHelpers: 'bundled',
  shouldPrintComment: comment => comment.includes('@__PURE__') ||
    comment.includes('@license') || comment.includes('@preserve') || comment.startsWith('!')
};

export default {
  input: 'src/index.js',
  external: ['marionette'],
  output: [
    {
      file: 'dist/index.js',
      format: 'es'
    },
    {
      file: 'dist/index.cjs',
      format: 'cjs',
      exports: 'named'
    }
  ],
  plugins: [babel(babelOptions)]
};
