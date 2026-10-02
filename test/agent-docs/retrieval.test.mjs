import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { documentSections, isConsumerPage } from '../../scripts/docs/sections.mjs';
import { skillRoutes } from '../../scripts/docs/agent-routes.mjs';
import { symbolIndex } from '../../scripts/docs/symbols.mjs';
import { prepareSectionSearch, searchSections } from '../../skills/marionette/scripts/search.mjs';

const root = resolve(import.meta.dirname, '../..');

test('section boundaries ignore code, include descendants, distinguish repeated headings and preserve CRLF offsets', () => {
  const text = 'Introduction\r\n\r\n# Page\r\n\r\n## `getUI(name)`\r\nText.\r\n\r\n```js\r\n# Not a heading\r\n```\r\n\r\n### Details\r\nNested.\r\n\r\n## Again\r\nOne.\r\n\r\n## Again\r\nTwo.\r\n';
  const sections = documentSections('docs/ui.md', text);
  assert.deepEqual(sections.map(section => section.heading), ['Introduction', 'Page', 'getUI(name)', 'Details', 'Again', 'Again']);
  assert.deepEqual(sections.map(section => section.id),
    ['@intro', 'page', 'getuiname', 'details', 'again', 'again-1'].map(anchor => `docs/ui.md#${anchor}`));
  assert.equal(text.slice(sections[0].start, sections[0].end), 'Introduction\r\n\r\n');
  assert.equal(text.slice(sections[2].start, sections[2].end), text.slice(text.indexOf('## `getUI'), text.indexOf('## Again')));
  assert.deepEqual(sections[3].ancestors, ['Page', 'getUI(name)']);
  assert.equal(text.slice(sections.at(-1).start, sections.at(-1).end), '## Again\r\nTwo.\r\n');
  assert.equal(documentSections('docs/plain.md', 'No headings.')[0].end, 12);
});

test('task routes resolve relative guides, preserve fragments and reject incomplete rows', () => {
  const marker = '<!-- task-routes:start -->';
  const end = '<!-- task-routes:end -->';
  const guide = `${marker}\n| Task | Guide | Check |\n| --- | --- | --- |\n| Edit | [Form](./forms.md#save), [Upgrade](../upgradeGuide.md) | Verify |\n${end}`;
  const skill = `Before\n${marker}\n${end}\nAfter`;
  const result = skillRoutes(guide, skill);
  assert.ok(result.includes('| Edit | `docs/forms.md#save`, `upgradeGuide.md` |'));
  assert.ok(result.startsWith('Before\n'));
  assert.ok(result.endsWith('\nAfter'));
  assert.throws(() => skillRoutes('', skill), /AGENT_ROUTES/);
  assert.throws(() => skillRoutes(guide.replace('[Form](./forms.md#save), [Upgrade](../upgradeGuide.md)', 'missing'), skill), /no guide/);
});

test('specific terms and headings outrank an incidental common word', () => {
  const content = '# Reference\n\n## event\nAn unrelated notification.\n\n## Read a control\nevent currentTarget delegateTarget\n\n## currentTarget delegateTarget\nevent currentTarget delegateTarget\n\n## Another complete answer\nevent currentTarget delegateTarget with additional explanation.\n';
  const files = new Map([['reference.md', { content: Buffer.from(content) }]]);
  const sections = documentSections('reference.md', content);
  const results = searchSections(sections, files, 'event currentTarget delegateTarget');
  assert.equal(results[0].heading, 'currentTarget delegateTarget');
  assert.equal(results[1].heading, 'Read a control');
  assert.ok(results.findIndex(result => result.heading === 'event') >
    results.findIndex(result => result.heading === 'Another complete answer'));
  assert.deepEqual(results[0].matchedTerms, ['event', 'currenttarget', 'current', 'target', 'delegatetarget', 'delegate']);
  assert.deepEqual(searchSections(sections, files, 'EVENT CURRENTTARGET DELEGATETARGET'), results,
    'Corpus identifier expansion is independent of query casing');
  assert.deepEqual(searchSections(sections, files, 'absentSymbol'), []);
  assert.deepEqual(searchSections(sections, files, 'the and'), []);
});

test('parent headings cannot borrow descendant matches while section reads retain their full spans', () => {
  const content = '# Manual\nOverview.\n\n## Account\nAccount settings.\n\n### Token renewal\nRenew a token.\n\n## Export\nExport a report.\n';
  const files = new Map([['manual.md', { content: Buffer.from(content) }]]);
  const sections = documentSections('manual.md', content);
  const results = searchSections(sections, files, 'token renewal');
  assert.deepEqual(results.map(result => result.heading), ['Token renewal']);
  const account = sections.find(section => section.heading === 'Account');
  assert(content.slice(account.start, account.end).includes('Renew a token.'));
  assert.deepEqual(searchSections(sections, files, 'Account').map(result => result.heading), ['Account'],
    'Ancestor context alone does not admit a child');
});

test('rare terms outrank repeated common terms and Markdown link paths do not create answers', () => {
  const content = '# Manual\n\n## Event notifications\nEvent event event event event event event.\n\n## Authorization\nRevoke a credential.\n\n## Links\n[Overview](./credential.md)\n' +
    ['Calendar', 'Delivery', 'History', 'Listeners', 'Logging', 'Controls'].map(heading => `\n## ${heading}\nObserve an event.\n`).join('');
  const files = new Map([['manual.md', { content: Buffer.from(content) }]]);
  const sections = documentSections('manual.md', content);
  assert.equal(searchSections(sections, files, 'event credential')[0].heading, 'Authorization');
  assert.deepEqual(searchSections(sections, files, 'credential').map(result => result.heading), ['Authorization']);
  assert.deepEqual(searchSections(sections, files, 'credential credential'), searchSections(sections, files, 'credential'));
  assert.deepEqual(searchSections([], files, 'credential'), []);
});

test('identifier expansion is order-independent and does not guess absent API names', () => {
  const files = new Map([['a.md', { content: Buffer.from('# AbC\nAn adapter.\n\n## Settings\nConfigure the adapter.\n') }],
    ['b.md', { content: Buffer.from('# ABc\nAnother adapter.\n\n## Options\nRead the adapter options.\n') }]]);
  const sections = [...files].flatMap(([source, file]) => documentSections(source, file.content.toString('utf8')));
  const expected = searchSections(sections, files, 'abc');
  assert.deepEqual(searchSections([...sections].reverse(), files, 'ABC'), expected);
  assert.deepEqual(searchSections([sections[3], sections[1], sections[2], sections[0]], files, 'abc'), expected);
  for (const query of ['MissingAdapterMethod', 'missingadaptermethod', 'MISSINGADAPTERMETHOD']) {
    assert.deepEqual(searchSections(sections, files, query), [], query);
  }
});

test('an intact API name ranks ahead of sections containing only a component word', () => {
  const content = '# Manual\n\n## Bindings\nCall getUI to read a control.\n\n## Other work\nGet another value.\n';
  const files = new Map([['manual.md', { content: Buffer.from(content) }]]);
  const sections = documentSections('manual.md', content);
  const results = searchSections(sections, files, 'getUI');
  assert.equal(results[0].heading, 'Bindings');
  assert.equal(results[1].heading, 'Other work');
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
      assert.ok(section.id.startsWith(`${page.source}#`));
      assert.equal(section.id.includes('#L'), false, 'Section identities follow Markdown anchors');
      previous = section.start;
    }
  }
  const cases = [
    ['getUI', 'docs/api/shared/view-bindings.md', 'UI bindings', ['NodeList', '[0]', 'snapshots']],
    ['bindUIElements', 'docs/api/shared/view-bindings.md', 'UI bindings', ['Behavior', 'existing contents']],
    ['delegateEvents', 'docs/api/shared/view-bindings.md', 'DOM events', ['no-ops while destroying/destroyed', 'delegates automatically']],
    ['event currentTarget delegateTarget', 'docs/api/shared/view-bindings.md', 'DOM events', ['`event.currentTarget` is the View\'s root element', '`event.delegateTarget` is the nearest matching descendant']],
    ['which element received the delegated click', 'docs/api/shared/view-bindings.md', 'DOM events', ['read the control matched by the selector', 'click originated inside that control']],
    ['my click handler runs twice', 'docs/api/shared/view-bindings.md', 'DOM events', ['Removes existing View/Behavior DOM handlers']],
    ['change view model after creation', 'docs/api/shared/view-bindings.md', 'Data bindings', ['does not change its existing subscriptions', 'Call `undelegateEntityEvents()` before assigning', 'then call `delegateEntityEvents()`', 'Render explicitly']],
    ['modelEvents render', 'docs/api/shared/view-bindings.md', 'Data bindings', ['do not automatically update', 'resets its Regions and destroys their children', 'do not own or destroy the model/collection']],
    ['initialize options', 'docs/api/shared/common.md', 'Options and initialization', ['initialize', 'options']],
    ['childViewEvents arguments', 'docs/api/shared/view-bindings.md', 'Child events', ['No child argument is added', 'original event arguments']],
    ['preserve editable rows sort', 'docs/guides/lists.md', 'Own the controls and repeated rows', ['Sorting moves the existing rows', 'input values']],
    ['setComparator viewComparator', 'docs/api/collection-view.md', 'Sorting', ['without changing the source collection', 'child Views']],
    ['observeCollection', 'docs/api/providers/data.md', 'DataApi', ['cleanup', 'DataApi has no disposal method']],
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

test('symbol index resolves every reviewed contract heading to exactly one consumer section', () => {
  const sections = documentSections('docs/region.md', '# Region\n\n## `show(view)`\nShow.\n\n## Again\nOne.\n\n## Again\nTwo.\n');
  const inventory = contracts => ({ entrypoints: [{ name: 'marionette', exports: [{ name: 'Region', kind: 'value',
    signature: 'RegionConstructor', contracts, instance: { show: '(view) => this' },
    memberContracts: { instance: { show: contracts } } }] }] });
  const semantics = heading => ({ contracts: [{ id: 'region', docs: [{ file: 'docs/region.md', heading }], diagnostics: [] }] });
  const index = symbolIndex(inventory(['region']), semantics('`show(view)`'), sections);
  assert.deepEqual(index.contracts.region.sections, ['docs/region.md#showview']);
  assert.deepEqual(index.symbols[0].instance.show.contracts, ['region'], 'declared member contracts remain available');
  assert.deepEqual(index.symbols[0].instance.show.primarySections, [], 'broad fallback is not an explicit primary section');
  assert.throws(() => symbolIndex(inventory(['region']), semantics('Missing'), sections), /matches 0/);
  assert.throws(() => symbolIndex(inventory(['region']), semantics('Again'), sections), /matches 2/);
  assert.throws(() => symbolIndex(inventory(['absent']), semantics('`show(view)`'), sections), /Unknown API contract: absent/);
  assert.throws(() => symbolIndex(inventory(['constructor']), semantics('`show(view)`'), sections), /Unknown API contract: constructor/);
});

test('canonical task routes match the skill and point at installed consumer pages', async() => {
  const guide = await readFile(resolve(root, 'docs/agents.md'), 'utf8');
  const skill = await readFile(resolve(root, 'skills/marionette/SKILL.md'), 'utf8');
  assert.equal(skillRoutes(guide, skill), skill);
  const pages = JSON.parse(await readFile(resolve(root, 'docs-site/navigation.json'), 'utf8'));
  const published = new Set(pages.filter(isConsumerPage).map(page => page.source));
  const table = skill.split('<!-- task-routes:start -->')[1].split('<!-- task-routes:end -->')[0];
  for (const [, href] of table.matchAll(/`([^`]+)`/g)) {
    const [source, fragment] = href.split('#');
    assert.ok(published.has(source), `${source}: task route must be an installed consumer page`);
    const markdown = await readFile(resolve(root, source), 'utf8');
    assert.ok(markdown.trim());
    if (fragment) {
      const sections = documentSections(source, markdown);
      assert.ok(sections.some(section => section.id === href), `${href}: task route must preserve an existing heading`);
    }
  }
});

test('prepared section search reads the corpus once and serves repeated queries', () => {
  const text = '# Manual\n\n## Events\nUse listenTo for events.\n\n## UI\nUse getUI to read controls.\n';
  let reads = 0;
  const files = new Map([['manual.md', { content: { toString() { reads++; return text; } } }]]);
  const sections = documentSections('manual.md', text);
  const search = prepareSectionSearch(sections, files);
  const preparedReads = reads;
  assert.equal(search('listenTo')[0].heading, 'Events');
  assert.equal(search('getUI')[0].heading, 'UI');
  assert.deepEqual(search('unmentioned'), []);
  assert.deepEqual(search('the'), []);
  assert.equal(reads, preparedReads);
  assert.ok(preparedReads > 0);
  assert.deepEqual(prepareSectionSearch([], files)('listenTo'), []);
});
