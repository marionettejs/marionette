import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { documentSections, isConsumerPage } from '../../scripts/docs/sections.mjs';
import { skillRoutes } from '../../scripts/docs/agent-routes.mjs';
import { searchSections } from '../../skills/marionette/scripts/search.mjs';

const root = resolve(import.meta.dirname, '../..');

test('section boundaries ignore code, include descendants, distinguish repeated headings and preserve CRLF offsets', () => {
  const text = 'Introduction\r\n\r\n# Page\r\n\r\n## `getUI(name)`\r\nText.\r\n\r\n```js\r\n# Not a heading\r\n```\r\n\r\n### Details\r\nNested.\r\n\r\n## Again\r\nOne.\r\n\r\n## Again\r\nTwo.\r\n';
  const sections = documentSections('docs/ui.md', text);
  assert.deepEqual(sections.map(section => section.heading), ['Introduction', 'Page', 'getUI(name)', 'Details', 'Again', 'Again']);
  assert.deepEqual(sections.map(section => section.id),
    ['intro', 'L3', 'L5', 'L12', 'L15', 'L18'].map(anchor => `docs/ui.md#${anchor}`));
  assert.equal(text.slice(sections[0].start, sections[0].end), 'Introduction\r\n\r\n');
  assert.equal(text.slice(sections[2].start, sections[2].end), text.slice(text.indexOf('## `getUI'), text.indexOf('## Again')));
  assert.deepEqual(sections[3].ancestors, ['Page', 'getUI(name)']);
  assert.equal(text.slice(sections.at(-1).start, sections.at(-1).end), '## Again\r\nTwo.\r\n');
  assert.equal(documentSections('docs/plain.md', 'No headings.')[0].end, 12);
});

test('task routes resolve relative guides to package sources and reject incomplete rows', () => {
  const marker = '<!-- task-routes:start -->';
  const end = '<!-- task-routes:end -->';
  const guide = `${marker}\n| Task | Guide | Check |\n| --- | --- | --- |\n| Edit | [Form](./forms.md#save), [Upgrade](../upgradeGuide.md) | Verify |\n${end}`;
  const skill = `Before\n${marker}\n${end}\nAfter`;
  const result = skillRoutes(guide, skill);
  assert.ok(result.includes('| Edit | `docs/forms.md`, `upgradeGuide.md` |'));
  assert.ok(result.startsWith('Before\n'));
  assert.ok(result.endsWith('\nAfter'));
  assert.throws(() => skillRoutes('', skill), /AGENT_ROUTES/);
  assert.throws(() => skillRoutes(guide.replace('[Form](./forms.md#save), [Upgrade](../upgradeGuide.md)', 'missing'), skill), /no guide/);
});

test('complete query coverage outranks a common heading word, then heading specificity and size break ties', () => {
  const content = '# Reference\n\n## event\nAn unrelated notification.\n\n## Read a control\nevent currentTarget delegateTarget\n\n## currentTarget delegateTarget\nevent currentTarget delegateTarget\n\n## Another complete answer\nevent currentTarget delegateTarget with additional explanation.\n';
  const files = new Map([['reference.md', { content: Buffer.from(content) }]]);
  const sections = documentSections('reference.md', content);
  const results = searchSections(sections, files, 'event currentTarget delegateTarget');
  assert.equal(results[0].heading, 'currentTarget delegateTarget');
  assert.equal(results[1].heading, 'Read a control');
  assert.ok(results.findIndex(result => result.heading === 'event') >
    results.findIndex(result => result.heading === 'Another complete answer'));
  assert.deepEqual(results[0].matchedTerms, ['event', 'currenttarget', 'delegatetarget']);
  assert.deepEqual(searchSections(sections, files, 'absentSymbol'), []);
  assert.deepEqual(searchSections(sections, files, 'the and'), []);
});

test('real consumer questions retrieve the required contract without reading a full API reference', async() => {
  const pages = JSON.parse(await readFile(resolve(root, 'docs-site/navigation.json'), 'utf8'))
    .filter(isConsumerPage);
  const files = new Map(await Promise.all(pages.map(async page =>
    [page.source, { content: await readFile(resolve(root, page.source)) }])));
  const sections = pages.flatMap(page => documentSections(page.source, files.get(page.source).content.toString('utf8')));
  for (const page of pages) {
    const text = files.get(page.source).content.toString('utf8');
    let previous = -1;
    for (const section of sections.filter(value => value.source === page.source)) {
      assert.ok(section.start > previous, `${section.id}: offsets must increase within each page`);
      assert.ok(section.end > section.start && section.end <= text.length, `${section.id}: invalid bounds`);
      if (!section.id.endsWith('#intro')) {
        const line = text.slice(0, section.start).split(/\r\n?|\n/).length;
        assert.equal(section.id, `${page.source}#L${line}`);
      }
      previous = section.start;
    }
  }
  const cases = [
    ['getUI', 'docs/dom.interactions.md', 'getUI(name)', ['NodeList', 'MN0023', 'template: false']],
    ['bindUIElements', 'docs/dom.interactions.md', 'bindUIElements()', ['template: false', 'Behavior', 'MN0023']],
    ['delegateEvents', 'docs/dom.interactions.md', 'delegateEvents(events)', ['no-ops after destruction', 'do not render', 'new matching descendants']],
    ['event currentTarget delegateTarget', 'docs/dom.interactions.md', 'Read the matched control', ['listener', 'nested', 'delegateTarget']],
    ['showChildView destroys listeners', 'docs/marionette.region.md', 'Pending work after replacement', ['destroy()', 'not cancel arbitrary promises', 'longer-lived owner']],
    ['save after destroy', 'docs/marionette.region.md', 'Pending work after replacement', ['retained draft', 'completion event']],
    ['initialize options', 'docs/common.md', 'initialize', ['options']],
    ['childViewEvents arguments', 'docs/events.md', 'Using CollectionView\'s childViewEvents', ['does not prepend', 'trigger']],
    ['unsaved changes form focus', 'docs/forms-and-accessibility.md', 'Save a form without losing focus', ['initialName', 'updateDraftStatus']],
    ['preserve editable rows sort', 'docs/list-composition.md', 'Add, remove, and reorder editable rows', ['Surviving child Views', 'input elements']],
  ];
  for (const [query, source, heading, facts] of cases) {
    const results = searchSections(sections, files, query);
    const match = results.find(result => result.source === source && result.heading.startsWith(heading));
    assert.ok(match, `${query}: expected contract in top five, got ${JSON.stringify(results.map(r => [r.source, r.heading]))}`);
    const text = files.get(source).content.toString('utf8').slice(match.start, match.end);
    for (const fact of facts) { assert.ok(text.includes(fact), `${query}: missing ${fact}`); }
    assert.ok(match.characters < 10000, `${query}: requires a full reference`);
    console.log(`${query}: rank ${results.indexOf(match) + 1}, ${match.characters} characters, ${match.id}`);
  }
});
