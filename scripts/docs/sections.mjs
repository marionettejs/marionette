import { marked } from 'marked';

export const isConsumerPage = page => page.section !== 'Maintaining Marionette';

// Build-time only. Consumers read verified offsets without a Markdown dependency.
export function documentSections(source, markdown) {
  const normalized = markdown.replace(/\r\n?/g, '\n');
  const offsets = [0];
  for (let index = 0; index < markdown.length; index++) {
    if (markdown[index] === '\r' && markdown[index + 1] === '\n') { index++; }
    offsets.push(index + 1);
  }
  const headings = [];
  let cursor = 0;
  for (const token of marked.lexer(normalized)) {
    const position = normalized.indexOf(token.raw, cursor);
    cursor = position + token.raw.length;
    if (token.type !== 'heading') { continue; }
    const start = offsets[position];
    const line = markdown.slice(0, start).split(/\r\n?|\n/).length;
    const heading = token.text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/<[^>]+>/g, '').replace(/[`*_~]/g, '');
    headings.push({ id: `${source}#L${line}`, source, heading, depth: token.depth, start });
  }
  if (!headings.length || headings[0].start > 0) {
    headings.unshift({ id: `${source}#intro`, source, heading: 'Introduction', depth: 0, start: 0 });
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
