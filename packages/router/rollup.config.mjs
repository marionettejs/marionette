import compile from '../../build/babel.js';

export default ['index', 'history'].map(entry => ({
  input: entry === 'history' ? 'src/drivers/history.ts' : 'src/index.ts',
  external: ['marionette', '@mnjs/utils'],
  output: [
    { file: `dist/${ entry }.js`, sourcemap: true, format: 'es' },
    { file: `dist/${ entry }.cjs`, sourcemap: true, format: 'cjs', exports: 'named' }
  ],
  plugins: [compile()]
}));
