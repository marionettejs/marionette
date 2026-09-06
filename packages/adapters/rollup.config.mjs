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
      {
        file: 'dist/dom/jquery.js',
        format: 'es'
      },
      {
        file: 'dist/dom/jquery.cjs',
        format: 'cjs',
        exports: 'default'
      }
    ],
    plugins: [compile()]
  },
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
  }))
];
