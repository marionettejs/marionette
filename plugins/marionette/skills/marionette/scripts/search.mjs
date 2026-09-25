const words = text => new Set(text.toLowerCase().match(/[\p{L}\p{N}_]+/gu) || []);
const stopWords = new Set(['a', 'an', 'and', 'the', 'to', 'in', 'of', 'for', 'with', 'how', 'do', 'i']);

export function searchSections(sections, files, query) {
  const terms = [...words(query)].filter(term => !stopWords.has(term));
  return sections.map(section => {
    const content = files.get(section.source).content.toString('utf8').slice(section.start, section.end);
    const heading = words(section.heading);
    const body = words(content);
    const matchedTerms = terms.filter(term => body.has(term));
    // Complete query coverage comes first. For partial matches, heading words
    // still favor the named API or task over incidental matches in a large guide.
    const score = terms.filter(term => heading.has(term)).length * 8 + matchedTerms.length * 3;
    return { ...section, characters: section.end - section.start, matchedTerms, score };
  }).filter(section => section.matchedTerms.length)
    .sort((a, b) => Number(b.matchedTerms.length === terms.length) - Number(a.matchedTerms.length === terms.length) ||
      b.score - a.score ||
      a.characters - b.characters || a.id.localeCompare(b.id, 'en'))
    .slice(0, 5);
}
