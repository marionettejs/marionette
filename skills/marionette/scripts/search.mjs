const words = text => text.match(/[\p{L}\p{N}_]+/gu) ?? [];
const parts = word => [...new Set([word, ...word.replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
  .replace(/([a-z\d])([A-Z])/g, '$1 $2').split(' ')].map(part => part.toLowerCase()))];
const stopWords = new Set(['a', 'an', 'and', 'the', 'to', 'in', 'of', 'for', 'with', 'how', 'do', 'i',
  'is', 'it', 'its', 'this', 'that', 'these', 'those', 'my', 'me', 'we', 'our', 'you', 'your',
  'can', 'could', 'should', 'would', 'does', 'did', 'what', 'which', 'when', 'where', 'why',
  'will', 'be', 'been', 'being', 'am', 'are', 'was', 'were', 'as', 'if', 'or', 'also']);

export function prepareSectionSearch(sections, files) {
  if (!sections.length) { return () => []; }
  const compounds = new Map();
  const tokenize = text => words(text).flatMap(word => {
    const tokens = parts(word);
    if (tokens.length > 1) {
      const key = word.toLowerCase();
      const components = new Set([...(compounds.get(key) ?? []), ...tokens]);
      compounds.set(key, [key, ...[...components].filter(token => token !== key).sort()]);
    }
    return tokens;
  });
  const orderedSections = [...sections].sort((a, b) => a.source.localeCompare(b.source, 'en') || a.start - b.start);
  const documents = orderedSections.map((section, index) => {
    // Score only this heading's own text. Descendants keep their own answers;
    // section reads still return the full original span, including descendants.
    const next = orderedSections[index + 1];
    const end = next?.source === section.source ? next.start : section.end;
    const content = files.get(section.source).content.toString('utf8').slice(section.start, end)
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
    const tokens = tokenize(content).filter(term => !stopWords.has(term));
    const frequency = new Map();
    for (const term of tokens) { frequency.set(term, (frequency.get(term) ?? 0) + 1); }
    return { section, frequency, length: tokens.length,
      heading: new Set(tokenize(section.heading)), context: new Set(tokenize(section.ancestors.join(' '))) };
  });
  const averageLength = documents.reduce((sum, document) => sum + document.length, 0) / documents.length || 1;
  const documentFrequency = new Map();
  for (const document of documents) {
    for (const term of document.frequency.keys()) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
  }
  return query => {
    // Use the corpus spelling for identifier components, regardless of query case.
    const terms = [...new Set(words(query).flatMap(word => compounds.get(word.toLowerCase()) ?? [word.toLowerCase()]))]
      .filter(term => !stopWords.has(term));
    if (!terms.length) { return []; }
    const weights = new Map(terms.map(term => {
      const count = documentFrequency.get(term) ?? 0;
      return [term, Math.log(1 + (documents.length - count + 0.5) / (count + 0.5))];
    }));
    // BM25 saturation and length normalization, with extra weight for the heading
    // and light ancestor context. Constants are fixed for every page and query.
    return documents.map(({ section, frequency, length, heading, context }) => {
      const matchedTerms = terms.filter(term => frequency.has(term));
      const score = matchedTerms.reduce((sum, term) => {
        const count = frequency.get(term);
        const body = count * 2.2 / (count + 1.2 * (0.25 + 0.75 * length / averageLength));
        return sum + weights.get(term) * (body + Number(heading.has(term)) * 2);
      }, 0) + terms.filter(term => context.has(term)).reduce((sum, term) => sum + weights.get(term) * 0.25, 0);
      return { ...section, characters: section.end - section.start, matchedTerms, score };
    }).filter(section => section.matchedTerms.length)
      .sort((a, b) => b.score - a.score ||
        a.characters - b.characters || a.id.localeCompare(b.id, 'en'))
      .slice(0, 5);
  };
}

export function searchSections(sections, files, query) {
  return prepareSectionSearch(sections, files)(query);
}
