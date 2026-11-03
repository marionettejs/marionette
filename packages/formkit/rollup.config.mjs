import compile from '../../build/babel.js';

export default {
  input: 'src/index.ts',
  external: ['marionette', '@formkit/core', '@formkit/validation', '@formkit/rules', '@formkit/i18n', '@formkit/inputs', '@formkit/themes', '@formkit/utils', '@formkit/observer'],
  output: [
    {
      file: 'dist/index.js',
      sourcemap: true, format: 'es'
    },
    {
      file: 'dist/index.cjs',
      sourcemap: true, format: 'cjs',
      exports: 'named',
      interop: 'esModule'
    }
  ],
  plugins: [compile()]
};
