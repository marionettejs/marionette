import compile from '../../build/babel.js';

export default ['index', 'scope', 'cypress', 'playwright', 'vitest', 'testing-library'].map(name => ({
  input: `src/${name}.${name === 'cypress' ? 'js' : 'ts'}`,
  external: ['marionette', '@cypress/mount-utils', 'vitest', '@testing-library/dom'],
  output: [
    { file: `dist/${name}.js`, sourcemap: true, format: 'es' },
    ...(name === 'vitest' ? [] : [{ file: `dist/${name}.cjs`, sourcemap: true, format: 'cjs', exports: 'named' }])
  ],
  plugins: [compile()]
}));
