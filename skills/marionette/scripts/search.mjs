const words = text => new Set(text.toLowerCase().match(/[\p{L}\p{N}_]+/gu) || []);
const stopWords = new Set(['a', 'an', 'and', 'the', 'to', 'in', 'of', 'for', 'with', 'how', 'do', 'i']);

export function searchSections(sections, files, query) {
  const terms = [...words(query)].filter(term => !stopWords.has(term));
  return sections.map(section => {
    const content = files.get(section.source).content.toString('utf8').slice(section.start, section.end);
    const heading = words(section.heading);
    const body = words(content);
    const matchedTerms = terms.filter(term => body.has(term));
    // Exact heading words favor the named API over incidental usage in a recipe.
    // Multiple matches outrank a single broad match; shorter ties avoid whole guides.
    const score = terms.filter(term => heading.has(term)).length * 8 + matchedTerms.length * 3;
    return { ...section, characters: section.end - section.start, matchedTerms, score };
  }).filter(section => section.matchedTerms.length)
    .sort((a, b) => b.score - a.score || a.characters - b.characters || a.id.localeCompare(b.id, 'en'))
    .slice(0, 5);
}
