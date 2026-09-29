import assert from 'node:assert/strict';
import test from 'node:test';
import { marked } from 'marked';
import { JSDOM } from 'jsdom';
import { diagnosticPage } from '../../scripts/docs/build.mjs';

for (const replacementCode of [undefined, 'MN9999']) {
  test(`diagnostic table renders ${replacementCode ? 'a replacement in the same table' : 'without a replacement'}`, () => {
    const markdown = diagnosticPage({ code: 'MN9998', slug: 'synthetic-diagnostic',
      severity: 'error', status: 'retired', category: 'lifecycle', objects: ['View'],
      surfaces: ['runtime'], replacementCode, remediation: 'Correct the owner.' });
    const document = new JSDOM(marked.parse(markdown)).window.document;
    assert.equal(document.querySelectorAll('table').length, 1);
    const rows = [...document.querySelectorAll('table tbody tr')].map(row => row.textContent.trim());
    assert.equal(rows.length, replacementCode ? 6 : 5);
    assert.equal(rows.some(row => row.startsWith('Replacement')), Boolean(replacementCode));
    assert.equal(document.querySelector('table a')?.getAttribute('href'), replacementCode ? '/errors/MN9999/' : undefined);
    assert.equal(document.body.textContent.includes('Benchmark category'), false);
  });
}
