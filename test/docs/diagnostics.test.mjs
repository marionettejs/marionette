import assert from 'node:assert/strict';
import test from 'node:test';
import { diagnosticSections } from '../../scripts/docs/diagnostics.mjs';

test('diagnostic sections preserve authored guidance and regenerate catalog remediation', () => {
  const page = '# Errors\n\nAuthored introduction.\n\n<!-- diagnostics:start -->\nOld content\n<!-- diagnostics:end -->\nAuthored conclusion.\n';
  const entry = { code: 'MN0004', slug: 'region-el-required', status: 'active', objects: ['Region'],
    remediation: 'Supply an element.', docsSection: 'docs/api/errors.md#mn0004' };
  const generated = diagnosticSections(page, { diagnostics: [entry] });
  assert.match(generated, /^# Errors\n\nAuthored introduction\./);
  assert.match(generated, /Authored conclusion\.\n$/);
  assert.match(generated, /## MN0004\n/);
  assert.match(generated, /Supply an element\./);
  assert.doesNotMatch(generated, /Old content/);
  assert.equal(diagnosticSections(generated, { diagnostics: [entry] }), generated);
  assert.throws(() => diagnosticSections(page, { diagnostics: [{ ...entry, docsSection: 'wrong' }] }), /DIAGNOSTIC_DOCS/);
});


test('diagnostic generation rejects missing, reversed, or duplicated markers', () => {
  for (const page of ['', '<!-- diagnostics:start -->', '<!-- diagnostics:end -->',
    '<!-- diagnostics:end --><!-- diagnostics:start -->',
    '<!-- diagnostics:start --><!-- diagnostics:start --><!-- diagnostics:end -->',
    '<!-- diagnostics:start --><!-- diagnostics:end --><!-- diagnostics:end -->']) {
    assert.throws(() => diagnosticSections(page, { diagnostics: [] }), /DIAGNOSTIC_DOCS/);
  }
});
