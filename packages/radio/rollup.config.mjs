import compile from '../../build/babel.js';

export default {
  input: 'src/index.ts',
  external: ['@marionette/utils'],
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
  plugins: [compile()]
};
