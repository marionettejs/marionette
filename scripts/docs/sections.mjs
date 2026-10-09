import { marked } from 'marked';
import { createSlugger, markdownRenderer, stripHeadingTags } from './headings.mjs';

export const isConsumerPage = page => page.section !== 'Maintaining Marionette';
export const plainHeading = text => stripHeadingTags(text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'))
  .replace(/[`*_~]/g, '');

// Build-time only. Consumers read verified offsets without a Markdown dependency.
export function documentSections(source, markdown) {
  const normalized = markdown.replace(/\r\n?/g, '\n');
  const offsets = [0];
  for (let index = 0; index < markdown.length; index++) {
    if (markdown[index] === '\r' && markdown[index + 1] === '\n') { index++; }
    offsets.push(index + 1);
  }
  const headings = [];
  const slug = createSlugger();
  let cursor = 0;
  for (const token of marked.lexer(normalized)) {
    const position = normalized.indexOf(token.raw, cursor);
    cursor = position + token.raw.length;
    // Nested headings still consume rendered anchors, although only top-level
    // blocks become retrievable sections with independently verified offsets.
    // The visitor returns only undefined; traversal completes synchronously.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    marked.walkTokens([token], item => {
      if (item.type !== 'heading') { return; }
      const anchor = slug(marked.parseInline(item.text, { renderer: markdownRenderer }));
      if (item !== token) { return; }
      headings.push({ id: `${source}#${anchor}`, source, heading: plainHeading(item.text),
        depth: item.depth, start: offsets[position] });
    });
  }
  if (!headings.length || headings[0].start > 0) {
    headings.unshift({ id: `${source}#@intro`, source, heading: 'Introduction', depth: 0, start: 0 });
  }
  return headings.map((heading, index) => ({
    ...heading,
    ancestors: headings.slice(0, index).reduce((parents, previous) => {
      while (parents.length && parents.at(-1).depth >= previous.depth) { parents.pop(); }
      parents.push(previous);
      return parents;
    }, []).filter(parent => parent.depth > 0 && parent.depth < heading.depth).map(parent => parent.heading),
    end: heading.depth === 0 ? (headings[index + 1]?.start ?? markdown.length) :
      (headings.slice(index + 1).find(next => next.depth <= heading.depth)?.start ?? markdown.length),
  }));
}
