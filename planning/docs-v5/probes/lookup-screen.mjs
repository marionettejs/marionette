import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { documentSections, isConsumerPage } from '../../../scripts/docs/sections.mjs';
import { searchSections } from '../../../skills/marionette/scripts/search.mjs';

// Planning-only measurement: no ranking changes, consumer exports or generated builds.
// Usage: node planning/docs-v5/probes/lookup-screen.mjs questions.json > results.json
const root = resolve(import.meta.dirname, '../../..');
assert.ok(process.argv[2], 'Provide a frozen question JSON file.');
const sha256 = value => createHash('sha256').update(value).digest('hex');
const questionBytes = await readFile(resolve(process.argv[2]));
const questions = JSON.parse(questionBytes);
assert.ok(Array.isArray(questions) && questions.length > 0, 'Questions must be a nonempty array.');
assert.equal(new Set(questions.map(item => item.id)).size, questions.length, 'Question IDs must be unique.');

const navigationBytes = await readFile(resolve(root, 'docs-site/navigation.json'));
const pages = JSON.parse(navigationBytes).filter(isConsumerPage);
const files = new Map(await Promise.all(pages.map(async page =>
  [page.source, { content: await readFile(resolve(root, page.source)) }])));
const sections = pages.flatMap(page => documentSections(page.source, files.get(page.source).content.toString('utf8')));
const corpusFiles = Object.fromEntries([...files].map(([source, file]) => [source, sha256(file.content)]));
const textFor = section => files.get(section.source).content.toString('utf8').slice(section.start, section.end);

const results = questions.map(question => {
  assert.ok(question.id && question.query && question.answers?.length, 'Each question needs an ID, query and answers.');
  const expected = question.answers.map(answer => {
    const matches = sections.filter(section => section.source === answer.source && section.heading === answer.heading);
    assert.equal(matches.length, 1, `${question.id}: expected one section for ${answer.source} / ${answer.heading}`);
    assert.ok(answer.facts?.length, `${question.id}: provide required answer evidence.`);
    const text = textFor(matches[0]);
    for (const fact of answer.facts) {
      assert.ok(fact.length && text.includes(fact), `${question.id}: missing expected fact ${JSON.stringify(fact)}`);
    }
    return { ...answer, id: matches[0].id };
  });
  const hits = searchSections(sections, files, question.query);
  const isExpected = hit => expected.some(answer => answer.id === hit.id);
  const rank = hits.findIndex(isExpected);
  const evidencePresent = hit => expected.some(answer => answer.facts.every(fact => textFor(hit).includes(fact)));
  return {
    id: question.id,
    query: question.query,
    expectation: question.expectation ?? 'contract',
    expected,
    expectedRank: rank < 0 ? null : rank + 1,
    top1ExpectedSection: Boolean(hits[0] && isExpected(hits[0])),
    top1ContainsRequiredEvidence: Boolean(hits[0] && evidencePresent(hits[0])),
    charactersBeforeExpectedSection: rank < 0 ? null : hits.slice(0, rank).reduce((sum, hit) => sum + hit.characters, 0),
    returnedCharacters: hits.reduce((sum, hit) => sum + hit.characters, 0),
    hits: hits.map(hit => ({
      id: hit.id, source: hit.source, heading: hit.heading, depth: hit.depth,
      characters: hit.characters, score: hit.score, matchedTerms: hit.matchedTerms,
      expectedSection: isExpected(hit), containsRequiredEvidence: evidencePresent(hit),
    })),
  };
});
const count = predicate => results.filter(predicate).length;
const implementationFiles = ['scripts/docs/sections.mjs', 'skills/marionette/scripts/search.mjs',
  'planning/docs-v5/probes/lookup-screen.mjs'];
const implementationHashes = Object.fromEntries(await Promise.all(implementationFiles.map(async source =>
  [source, sha256(await readFile(resolve(root, source)))])));
console.log(JSON.stringify({
  schemaVersion: 1,
  measuredAt: new Date().toISOString(),
  revision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  provenance: {
    questionSha256: sha256(questionBytes), navigationSha256: sha256(navigationBytes),
    corpusSha256: sha256(JSON.stringify(corpusFiles)), corpusFiles, implementationHashes,
  },
  summary: {
    questions: results.length, top1ExpectedSection: count(result => result.top1ExpectedSection),
    top1ContainsRequiredEvidence: count(result => result.top1ContainsRequiredEvidence),
    top5ExpectedSection: count(result => result.expectedRank !== null),
    top5ContainsRequiredEvidence: count(result => result.hits.some(hit => hit.containsRequiredEvidence)),
    noResults: count(result => !result.hits.length),
    top1PageHeading: count(result => result.hits[0]?.depth === 1),
    returnedCharacters: results.reduce((sum, result) => sum + result.returnedCharacters, 0),
  },
  limits: [
    'Exact-section precision and literal answer evidence are separate measurements.',
    'A parent section may contain the answer; a broad result is not automatically wrong.',
    'Returned characters count overlapping snippets as returned, not unique text or model tokens.',
    'A missing expected section in five results is not proof that the corpus lacks an answer.',
    'This exposed question set is regression evidence, not an unseen reader or application trial.',
    'This measures source helper search, not installed tooling, website search or model outcomes.',
  ],
  results,
}, null, 2));
