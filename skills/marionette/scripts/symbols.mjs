const identifier = '[A-Za-z_$][\\w$]*';
const pattern = new RegExp(`^(${identifier})(?:\\.(${identifier}))?$`);
// Index key → member access label and export listing field.
const accesses = [['static', 'static', 'staticMembers'], ['instance', 'instance', 'instanceMembers'],
  ['members', 'member', 'members']];
const invalid = () => new Error('Invalid documentation symbol index.');
const isMap = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const shownMentions = 5;

export function validateSymbolIndex(index, sectionIds) {
  const contracts = index?.contracts;
  if (index?.schemaVersion !== 2 || !Array.isArray(index.symbols) || !isMap(contracts)) {
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
    for (const [key] of accesses) {
      if (symbol[key] !== undefined && (!isMap(symbol[key]) || !Object.values(symbol[key]).every(member =>
        typeof member?.signature === 'string' && known(member.contracts) &&
        Array.isArray(member.primarySections) && member.primarySections.every(id => sectionIds.has(id) &&
          member.contracts.some(contract => contracts[contract].sections.includes(id)))))) { throw invalid(); }
    }
  }
}

// Sections on the member's contract pages whose own text, before any subsection,
// uses it in code, in contract order; headings naming the member come first.
// A trailing declaration colon is allowed; event fragments and link text are not.
function mentions(key, contractIds, index, sections, files, primarySections) {
  const name = new RegExp(`(?<![\\w$:])${key.replaceAll('$', '\\$')}(?![\\w$]|:[\\w$])`);
  const pages = [...new Set(contractIds.flatMap(id => index.contracts[id].sections.map(section => section.split('#')[0])))];
  const hits = sections.flatMap((section, position) => {
    if (section.depth === 0 || !pages.includes(section.source) || primarySections.includes(section.id)) { return []; }
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
  const members = (symbol, key) => accesses.flatMap(([property, access]) => {
    const operation = symbol[property] && Object.hasOwn(symbol[property], key) && symbol[property][key];
    if (!operation) { return []; }
    const found = mentions(key, operation.contracts, index, sections, files, operation.primarySections);
    return [{ entrypoint: symbol.entrypoint, name: symbol.name, member: key, access, ...operation, ...found }];
  });
  const exports = index.symbols.filter(symbol => symbol.name === name);
  let matches;
  if (member) {
    matches = exports.flatMap(symbol => members(symbol, member));
  } else {
    // Type-only members usually restate a runtime class; list them only for names
    // no runtime export provides. `Type.member` always reaches them.
    const runtime = index.symbols.filter(symbol => symbol.kind === 'value').flatMap(symbol => members(symbol, name));
    matches = [
      ...exports.map(({ entrypoint, kind, signature, contracts, ...symbol }) => ({
        entrypoint, name, kind, signature, contracts,
        ...Object.fromEntries(accesses.filter(([property]) => Object.keys(symbol[property] ?? {}).length)
          .map(([property, , listing]) => [listing, Object.keys(symbol[property])])),
      })),
      ...runtime.length ? runtime :
        index.symbols.filter(symbol => symbol.kind !== 'value').flatMap(symbol => members(symbol, name)),
    ];
  }
  const contracts = Object.fromEntries([...new Set(matches.flatMap(match => match.contracts))]
    .map(id => [id, index.contracts[id]]));
  return { query, matches, contracts };
}
