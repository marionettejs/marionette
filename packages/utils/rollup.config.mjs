import compile from '../../build/babel.js';
import json from '@rollup/plugin-json';

export default {
  input: 'src/index.ts',
  output: [
    { file: 'dist/index.js', sourcemap: true, format: 'es' },
    { file: 'dist/index.cjs', sourcemap: true, format: 'cjs', exports: 'named' }
  ],
  plugins: [json(), compile()]
};
