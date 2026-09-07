import compile from '../../build/babel.js';

export default [
  {
    input: 'src/data/backbone.ts',
    output: [
      {
        file: 'dist/backbone.js',
        format: 'es'
      },
      {
        file: 'dist/backbone.cjs',
        format: 'cjs',
        exports: 'default'
      }
    ],
    plugins: [compile()]
  },
  {
    input: 'src/dom/jquery.ts',
    external: ['jquery'],
    output: [
      { file: 'dist/dom/jquery.js', format: 'es' },
      { file: 'dist/dom/jquery.cjs', format: 'cjs', exports: 'default' }
    ],
    plugins: [compile()]
  },
  {
    input: 'src/data/xstate.ts',
    output: [
      { file: 'dist/xstate.js', format: 'es' },
      { file: 'dist/xstate.cjs', format: 'cjs', exports: 'default' }
    ],
    plugins: [compile()]
  },
  ...['morphdom', 'lit-html'].map(name => ({
    input: `src/dom/${ name }.ts`,
    external: [name],
    output: [
      { file: `dist/dom/${ name }.js`, format: 'es' },
      { file: `dist/dom/${ name }.cjs`, format: 'cjs', exports: 'default' }
    ],
    plugins: [compile()]
  }))
];
