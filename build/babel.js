import babel from '@rollup/plugin-babel';
import typescript from '@babel/plugin-transform-typescript';

export default function compile() {
  return babel({
    babelHelpers: 'bundled',
    extensions: ['.js', '.ts'],
    overrides: [{
      test: /\.ts$/,
      plugins: [[typescript, { onlyRemoveTypeImports: true }]],
    }],
    shouldPrintComment: comment => comment.includes('@__PURE__') ||
      comment.includes('@license') || comment.includes('@preserve') || comment.startsWith('!'),
  });
}
