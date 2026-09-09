import parser from '@typescript-eslint/parser';
import marionette from 'marionette/eslint';

export default [
  { ignores: ['dist/**'] },
  marionette.configs.recommended,
  { files: ['**/*.ts'], languageOptions: { parser } }
];
