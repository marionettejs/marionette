import compile from '../../build/babel.js';

export default ['index', 'outlet'].map(entry => ({
  input: `src/${ entry }.ts`,
  external: ['@mnjs/utils', 'marionette'],
  output: [
    { file: `dist/${ entry }.js`, sourcemap: true, format: 'es' },
    { file: `dist/${ entry }.cjs`, sourcemap: true, format: 'cjs', exports: 'named' }
  ],
  plugins: [compile()]
}));
