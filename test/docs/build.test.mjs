import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { marked } from 'marked';
import { JSDOM } from 'jsdom';
import { diagnosticPage } from '../../scripts/docs/build.mjs';
import { addHeadingIds, markdownRenderer } from '../../scripts/docs/headings.mjs';
import { documentSections, isConsumerPage } from '../../scripts/docs/sections.mjs';

function assertSectionAnchors(source, markdown) {
  const document = new JSDOM(addHeadingIds(marked.parse(markdown, { renderer: markdownRenderer }))).window.document;
  const sections = documentSections(source, markdown);
  assert.equal(new Set(sections.map(section => section.id)).size, sections.length);
  for (const section of sections) {
    if (section.depth === 0) {
      assert.equal(section.id, `${source}#@intro`);
    } else {
      assert.ok(document.getElementById(section.id.split('#')[1]), `${section.id}: missing rendered anchor`);
    }
  }
  return sections;
}

test('section IDs match rendered Markdown anchors with formatting, entities and nested duplicate headings', () => {
  const markdown = 'Introduction\r\n\r\n# **Root**\r\n\r\n## `getUI(name)`\r\nBody.\r\n\r\n' +
    '> ## Again\r\n\r\n## Again\r\nBody.\r\n\r\n## <em>HTML</em> &amp; &#65;\r\nBody.\r\n';
  const sections = assertSectionAnchors('docs/parity.md', markdown);
  assert.deepEqual(sections.map(section => section.id), ['@intro', 'root', 'getuiname', 'again-1', 'emhtmlem--a']
    .map(anchor => `docs/parity.md#${anchor}`));
  assert.equal(assertSectionAnchors('docs/plain.md', 'No headings.')[0].id, 'docs/plain.md#@intro');
});

test('all consumer section IDs resolve to their rendered page anchors', async() => {
  const root = resolve(import.meta.dirname, '../..');
  const pages = JSON.parse(await readFile(resolve(root, 'docs-site/navigation.json'), 'utf8')).filter(isConsumerPage);
  for (const page of pages) {
    assertSectionAnchors(page.source, await readFile(resolve(root, page.source), 'utf8'));
  }
});

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


test('section anchors stay unique for suffix collisions, empty headings and invalid entities', () => {
  assertSectionAnchors('docs/anchors.md', '# A\n\n## A\n\n## A-1\n\n## !!!\n\n## ???\n\n## &#x110000;\n');
  const document = new JSDOM(addHeadingIds(marked.parse('# A\n\n## A\n\n## A-1\n\n## !!!\n\n## ???\n', { renderer: markdownRenderer }))).window.document;
  assert.deepEqual([...document.querySelectorAll('h1, h2')].map(heading => heading.id), ['a', 'a-1', 'a-1-1', 'section', 'section-1']);
});
