import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ExecutableExampleContractError,
  validateExecutableExamples,
} from '../../scripts/docs/check-executable-examples.mjs';

const marker = id => `<!-- executable-example: ${id} -->`;
const document = (path, id, fence = '```javascript\nconst example = true;\n```') => ({
  contents: `${marker(id)}\n${fence}`,
  path,
});
const validator = (path, ...ids) => ({
  contents: ids.map(marker).join('\n'),
  path,
});

function expectContractError(input, message) {
  assert.throws(
    () => validateExecutableExamples(input),
    error => error instanceof ExecutableExampleContractError &&
      error.errors.some(contractError => contractError.includes(message)),
  );
}

test('accepts unique documented examples with one fixture owner each', () => {
  const result = validateExecutableExamples({
    documents: [
      document('docs/one.md', 'first-example'),
      document('docs/two.md', 'second-example'),
    ],
    validators: [
      validator('test/fixtures/docs-examples/validate.mjs', 'first-example', 'second-example'),
    ],
  });

  assert.deepEqual(result, { exampleCount: 2, validatorCount: 1 });
});

test('rejects marker IDs that are not lowercase hyphenated slugs', () => {
  expectContractError({
    documents: [document('docs/example.md', 'Invalid_Example')],
    validators: [validator('test/fixtures/docs-example/validate.mjs', 'Invalid_Example')],
  }, 'must be a lowercase hyphenated slug');
});

test('rejects a marker without an immediately following javascript fence', () => {
  [
    'Explanation\n```javascript\nconst example = true;\n```',
    '\n```javascript\nconst example = true;\n```',
    '```javascript\nconst example = true;\n``` trailing',
  ].forEach(fence => {
    expectContractError({
      documents: [document('docs/example.md', 'example', fence)],
      validators: [validator('test/fixtures/docs-example/validate.mjs', 'example')],
    }, 'must be followed immediately by a javascript fence');
  });

  expectContractError({
    documents: [{
      contents: `${marker('example')} \`\`\`javascript\nconst example = true;\n\`\`\``,
      path: 'docs/example.md',
    }],
    validators: [validator('test/fixtures/docs-example/validate.mjs', 'example')],
  }, 'must be followed immediately by a javascript fence');
});

test('rejects duplicate documentation marker IDs', () => {
  const input = {
    documents: [
      {
        contents: `${document('docs/example.md', 'example').contents}\n${document('docs/example.md', 'example').contents}`,
        path: 'docs/example.md',
      },
    ],
    validators: [validator('test/fixtures/docs-example/validate.mjs', 'example')],
  };

  assert.throws(
    () => validateExecutableExamples(input),
    error => error instanceof ExecutableExampleContractError &&
      error.errors.includes('executable example "example" appears in multiple documentation locations: docs/example.md'),
  );
});

test('rejects a documented example without a fixture owner', () => {
  expectContractError({
    documents: [document('docs/example.md', 'example')],
    validators: [],
  }, 'has no fixture validator');
});

test('rejects a documented example with multiple fixture owners', () => {
  expectContractError({
    documents: [document('docs/example.md', 'example')],
    validators: [
      validator('test/fixtures/docs-one/validate.mjs', 'example'),
      validator('test/fixtures/docs-two/validate.mjs', 'example'),
    ],
  }, 'has multiple fixture validators');
});

test('rejects a fixture marker without a documented example', () => {
  expectContractError({
    documents: [],
    validators: [validator('test/fixtures/docs-example/validate.mjs', 'example')],
  }, 'has no documentation example');
});
