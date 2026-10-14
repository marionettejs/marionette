import compile from '../../build/babel.js';

export default ['index', 'cypress', 'playwright', 'vitest'].map(name => ({
  input: `src/${name}.${name === 'cypress' ? 'js' : 'ts'}`,
  external: ['marionette', '@cypress/mount-utils', 'vitest'],
  output: [
    { file: `dist/${name}.js`, sourcemap: true, format: 'es' },
    ...(name === 'vitest' ? [] : [{ file: `dist/${name}.cjs`, sourcemap: true, format: 'cjs', exports: 'named' }])
  ],
  plugins: [compile()]
}));
