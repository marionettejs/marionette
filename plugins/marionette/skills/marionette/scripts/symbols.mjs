const identifier = '[A-Za-z_$][\\w$]*';
const pattern = new RegExp(`^(${identifier})(?:\\.(${identifier}))?$`);
const accesses = ['static', 'instance'];
const invalid = () => new Error('Invalid documentation symbol index.');
const shownMentions = 5;

export function validateSymbolIndex(index, sectionIds) {
  const contracts = index?.contracts;
  if (index?.schemaVersion !== 1 || !Array.isArray(index.symbols) || !contracts || typeof contracts !== 'object') {
    throw new Error('Unsupported documentation symbol index.');
  }
  for (const contract of Object.values(contracts)) {
    if (!Array.isArray(contract?.sections) || !contract.sections.every(id => sectionIds.has(id)) ||
        !Array.isArray(contract.diagnostics)) { throw invalid(); }
  }
  const known = ids => Array.isArray(ids) && ids.every(id => typeof id === 'string' && Object.hasOwn(contracts, id));
  for (const symbol of index.symbols) {
    if (typeof symbol?.entrypoint !== 'string' || typeof symbol.name !== 'string' ||
        typeof symbol.signature !== 'string' || !known(symbol.contracts)) { throw invalid(); }
    for (const access of accesses) {
      if (symbol[access] !== undefined && !Object.values(symbol[access]).every(member =>
        typeof member?.signature === 'string' && known(member.contracts))) { throw invalid(); }
    }
  }
}

// Sections on the member's contract pages whose own text, before any subsection,
// uses it in code, in contract order; headings naming the member come first.
// Link text and event names such as `before:destroy` do not document the method.
function mentions(key, contractIds, index, sections, files) {
  const name = new RegExp(`(?<![\\w$:])${key.replaceAll('$', '\\$')}(?![\\w$:])`);
  const pages = [...new Set(contractIds.flatMap(id => index.contracts[id].sections.map(section => section.split('#')[0])))];
  const hits = sections.flatMap((section, position) => {
    if (section.depth === 0 || !pages.includes(section.source)) { return []; }
    const next = sections[position + 1];
    const own = files.get(section.source).content.toString('utf8')
      .slice(section.start, next?.source === section.source ? next.start : section.end)
      .replace(/\[[^\]\n]*\]\([^)\n]*\)/g, '');
    return (own.match(/```[\s\S]*?```|`[^`\n]+`/g) ?? []).some(code => name.test(code)) ?
      [{ section, position, named: name.test(section.heading) }] : [];
  }).sort((a, b) => Number(b.named) - Number(a.named) ||
    pages.indexOf(a.section.source) - pages.indexOf(b.section.source) || a.position - b.position);
  return {
    sections: hits.slice(0, shownMentions).map(({ section }) => ({ id: section.id, heading: section.heading,
      ancestors: section.ancestors, characters: section.end - section.start })),
    omittedSections: Math.max(0, hits.length - shownMentions),
  };
}

// Exact public names only: a symbol lookup never guesses between similar APIs.
export function findSymbols(index, sections, files, query) {
  const parts = pattern.exec(query);
  if (!parts) { throw new Error('Symbol lookup takes an export name, Export.member, or member name.'); }
  const [, name, member] = parts;
  const members = (symbol, key) => accesses.flatMap(access => {
    const operation = symbol[access] && Object.hasOwn(symbol[access], key) && symbol[access][key];
    if (!operation) { return []; }
    const scope = operation.contracts.length ? operation.contracts : symbol.contracts;
    return [{ entrypoint: symbol.entrypoint, name: symbol.name, member: key, access, ...operation,
      ...mentions(key, scope, index, sections, files) }];
  });
  const exports = index.symbols.filter(symbol => symbol.name === name);
  let matches;
  if (member) {
    matches = exports.flatMap(symbol => members(symbol, member));
  } else {
    matches = exports.map(({ entrypoint, kind, signature, contracts, ...symbol }) => ({
      entrypoint, name, kind, signature, contracts,
      ...Object.fromEntries(accesses.filter(access => symbol[access])
        .map(access => [`${access}Members`, Object.keys(symbol[access])])),
    }));
    if (!matches.length) {
      matches = index.symbols.filter(symbol => symbol.kind === 'value').flatMap(symbol => members(symbol, name));
    }
  }
  const byId = new Map(sections.map(section => [section.id, section]));
  const contracts = Object.fromEntries([...new Set(matches.flatMap(match => match.contracts))].map(id => [id, {
    diagnostics: index.contracts[id].diagnostics,
    sections: index.contracts[id].sections.map(sectionId => {
      const { heading, ancestors, start, end } = byId.get(sectionId);
      return { id: sectionId, heading, ancestors, characters: end - start };
    }),
  }]));
  return { query, matches, contracts };
}
