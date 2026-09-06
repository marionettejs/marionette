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
  ...['jquery', 'jquery-view'].map(name => ({
    input: `src/dom/${ name }.ts`,
    external: ['jquery'],
    output: [
      { file: `dist/dom/${ name }.js`, format: 'es' },
      { file: `dist/dom/${ name }.cjs`, format: 'cjs', exports: 'default' }
    ],
    plugins: [compile()]
  })),
  ...['redux', 'zustand', 'xstate-store', 'xstate'].map(name => ({
    input: `src/data/${ name }.ts`,
    output: [
      {
        file: `dist/${ name }.js`,
        format: 'es'
      },
      {
        file: `dist/${ name }.cjs`,
        format: 'cjs',
        exports: 'default'
      }
    ],
    plugins: [compile()]
  })),
  ...['morphdom', 'lit-html'].map(name => ({
    input: `src/render/${ name }.ts`,
    external: [name],
    output: [
      { file: `dist/render/${ name }.js`, format: 'es' },
      { file: `dist/render/${ name }.cjs`, format: 'cjs', exports: 'default' }
    ],
    plugins: [compile()]
  }))
];
