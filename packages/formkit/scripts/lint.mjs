import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { relative } from 'node:path';
import { ESLint } from 'eslint';
import vitest from '@vitest/eslint-plugin';
import { rollup } from 'rollup';
import config from '../rollup.config.mjs';
const repository = fileURLToPath(new URL('../../../', import.meta.url));
const bundle = await rollup(config);
let runtimeFiles;
try { runtimeFiles = bundle.watchFiles.filter(file => !file.includes('/node_modules/')); } finally { await bundle.close(); }
const eslint = new ESLint({
  cwd: repository,
  overrideConfigFile: fileURLToPath(new URL('../../../eslint.config.mjs', import.meta.url)),
  overrideConfig: [{
    files: ['packages/formkit/test/**/*.spec.mjs'],
    plugins: { vitest },
    rules: {
      'vitest/no-disabled-tests': 'error',
      'vitest/no-focused-tests': 'error',
      'vitest/valid-describe-callback': 'error',
      'vitest/valid-expect': 'error',
      'vitest/valid-expect-in-promise': 'error'
    }
  }]
});
const targets = [
  ...runtimeFiles,
  'packages/formkit/src/**/*.mjs', 'packages/formkit/scripts/**/*.mjs',
  'packages/formkit/test/**/*.spec.mjs', 'packages/formkit/test/fixtures/**/*.mjs',
  'packages/formkit/rollup.config.mjs', 'packages/formkit/vitest.config.mjs'
];
const results = await eslint.lintFiles(targets);
const errors = results.reduce((total, result) => total + result.errorCount, 0);
const warnings = results.reduce((total, result) => total + result.warningCount, 0);
const report = {
  passed: errors === 0 && warnings === 0, errors, warnings,
  runtimeFiles: runtimeFiles.map(file => relative(repository, file)),
  files: results.map(result => ({ file: relative(repository, result.filePath), errors: result.errorCount, warnings: result.warningCount, messages: result.messages }))
};
await mkdir(new URL('../test/tmp/', import.meta.url), { recursive: true });
await writeFile(new URL('../test/tmp/lint-result.json', import.meta.url), `${JSON.stringify(report, null, 2)}\n`);
const formatter = await eslint.loadFormatter('stylish');
console.log(formatter.format(results));
console.log(`FormKit package graph: ${runtimeFiles.length} source files; ${errors} errors, ${warnings} warnings.`);
if (!report.passed) {process.exitCode = 1;}
