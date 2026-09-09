import compile from '../../build/babel.js';

export default {
  input: 'src/index.ts',
  external: ['@mnjs/utils'],
  output: [
    {
      file: 'dist/index.js',
      sourcemap: true, format: 'es'
    },
    {
      file: 'dist/index.cjs',
      sourcemap: true, format: 'cjs',
      exports: 'named'
    }
  ],
  plugins: [compile()]
};
