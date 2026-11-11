import js from '@eslint/js';
import parser from '@typescript-eslint/parser';
import typescript from '@typescript-eslint/eslint-plugin';
import globals from 'globals';

// Use the repository's pinned lint toolchain without reformatting upstream style.
export default [
  {ignores: ['**/dist/**', '**/vendor/**', '**/node_modules/**', '**/coverage/**', '**/evidence/**']},
  {
    files: ['**/*.ts', '**/*.mjs'],
    languageOptions: {parser, ecmaVersion: 'latest', sourceType: 'module', globals: {...globals.browser, ...globals.node}},
    plugins: {'@typescript-eslint': typescript},
    rules: {
      ...js.configs.recommended.rules,
      'no-undef': 'off', // TypeScript checks authored source; JS globals are checked below.
      'no-unused-vars': 'off',
      'no-redeclare': 'off',
      // TypeScript validates duplicate declarations, including legal value/type pairs.

      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-namespace': 'error',
      // Uppercase exceptions are existing value constants used only in exported types.
      '@typescript-eslint/no-unused-vars': ['error', {argsIgnorePattern: '^_', varsIgnorePattern: '^_|^(COMMENT_PART|HTML_RESULT)$', caughtErrors: 'none', ignoreRestSiblings: true}],
      'no-constant-condition': ['error', {checkLoops: false}],
    },
  },
  {files: ['**/*.mjs'], rules: {'no-undef': 'error', 'no-redeclare': 'error'}},
];
