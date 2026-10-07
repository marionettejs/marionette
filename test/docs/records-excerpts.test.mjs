import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { marked } from 'marked';

const root = resolve(import.meta.dirname, '../..');

test('Records lesson excerpts match their adjacent source links', async() => {
  const markdown = await readFile(resolve(root, 'docs/records.md'), 'utf8');
  const tokens = marked.lexer(markdown).filter(token => token.type !== 'space');
  let excerpts = 0;
  for (const [index, token] of tokens.entries()) {
    if (token.type !== 'code' || token.lang !== 'js') { continue; }
    const label = `Excerpt ${++excerpts}`;
    const caption = tokens[index - 1];
    assert.equal(caption?.type, 'paragraph', `${label} needs a source caption`);
    const links = caption.tokens.filter(inline => inline.type === 'link' &&
      /^\.\.\/examples\/records\/src\/[\w-]+\.js$/.test(inline.href));
    assert.equal(links.length, 1, `${label} must name exactly one source module`);
    const source = await readFile(resolve(root, 'docs', links[0].href), 'utf8');
    assert(token.text.trim(), `${label} must not be empty`);
    assert(source.includes(token.text.trim()), `${label} no longer matches ${links[0].href}`);
  }
  assert(excerpts, 'The lesson must contain JavaScript excerpts');
});
