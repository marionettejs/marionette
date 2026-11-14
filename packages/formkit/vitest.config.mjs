import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { relative, sep } from 'node:path';
import { rollup } from 'rollup';
import buildConfig from './rollup.config.mjs';
const packageRoot = fileURLToPath(new URL('./', import.meta.url));
export default defineConfig(async() => {
  const bundle = await rollup(buildConfig);
  let sourceFiles;
  try { sourceFiles = bundle.watchFiles.filter(file => !file.includes('/node_modules/')); } finally { await bundle.close(); }
  return {
    root: packageRoot,
    resolve: { alias: [
      { find: /^@mnjs\/formkit\/components$/, replacement: fileURLToPath(new URL('src/components.mjs', import.meta.url)) },
      { find: /^@mnjs\/formkit$/, replacement: fileURLToPath(new URL('src/index.mjs', import.meta.url)) }
    ] },
    test: {
      name: '@mnjs/formkit', environment: 'jsdom', globals: false,
      include: ['test/**/*.spec.mjs'], restoreMocks: true, clearMocks: true,
      passWithNoTests: false,
      coverage: {
        provider: 'v8', include: sourceFiles.map(file => relative(packageRoot, file).split(sep).join('/')),
        reportsDirectory: 'coverage', reporter: ['text-summary', 'json-summary', 'lcov']
      }
    }
  };
});
