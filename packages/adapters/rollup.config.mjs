import compile from '../../build/babel.js';

export default [
  {
    input: 'src/data/backbone.ts',
    output: [
      {
        file: 'dist/backbone.js',
        sourcemap: true,
        format: 'es'
      },
      {
        file: 'dist/backbone.cjs',
        sourcemap: true,
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
      { file: 'dist/dom/jquery.js', sourcemap: true, format: 'es' },
      { file: 'dist/dom/jquery.cjs', sourcemap: true, format: 'cjs', exports: 'default' }
    ],
    plugins: [compile()]
  },
  {
    input: 'src/data/xstate.ts',
    output: [
      { file: 'dist/xstate.js', sourcemap: true, format: 'es' },
      { file: 'dist/xstate.cjs', sourcemap: true, format: 'cjs', exports: 'default' }
    ],
    plugins: [compile()]
  },
  ...['morphdom', 'lit-html'].map(name => ({
    input: `src/dom/${ name }.ts`,
    external: [name],
    output: [
      { file: `dist/dom/${ name }.js`, sourcemap: true, format: 'es' },
      { file: `dist/dom/${ name }.cjs`, sourcemap: true, format: 'cjs', exports: 'default' }
    ],
    plugins: [compile()]
  }))
];
