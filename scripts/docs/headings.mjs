import { Renderer } from 'marked';

// Build-time rendering and section IDs share the same heading contract.
export const markdownRenderer = new Renderer();
markdownRenderer.html = token => escapeHtml(token.raw);

function decodeEntities(value) {
  const named = {
    amp: '&',
    apos: '\'',
    gt: '>',
    lt: '<',
    quot: '"',
  };

  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, code) => {
    if (code[0] === '#') {
      const radix = code[1].toLowerCase() === 'x' ? 16 : 10;
      const digits = radix === 16 ? code.slice(2) : code.slice(1);
      return String.fromCodePoint(parseInt(digits, radix));
    }

    return named[code.toLowerCase()] || entity;
  });
}

export function textFromHeading(value) {
  return decodeEntities(value.replace(/<[^>]+>/g, ''));
}

export function createSlugger() {
  const occurrences = new Map();

  return value => {
    const base = textFromHeading(value)
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s/g, '-');
    const occurrence = occurrences.get(base) || 0;
    occurrences.set(base, occurrence + 1);
    return occurrence ? `${base}-${occurrence}` : base;
  };
}

export function addHeadingIds(html) {
  const slug = createSlugger();

  return html.replace(/<h([1-6])>([\s\S]*?)<\/h\1>/g, (heading, level, contents) => {
    return `<h${level} id="${slug(contents)}">${contents}</h${level}>`;
  });
}

export function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
