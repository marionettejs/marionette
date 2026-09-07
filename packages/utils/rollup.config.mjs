import compile from '../../build/babel.js';
import json from '@rollup/plugin-json';

export default {
  input: 'src/index.ts',
  output: [
    { file: 'dist/index.js', format: 'es' },
    { file: 'dist/index.cjs', format: 'cjs', exports: 'named' }
  ],
  plugins: [json(), compile()]
};
