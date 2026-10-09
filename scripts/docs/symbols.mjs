import { plainHeading } from './sections.mjs';

// Build-time only. Links each public export and member to the packaged sections
// that own its reviewed contract, so the helper never parses declarations.
export function symbolIndex(inventory, semantics, sections) {
  const sectionIds = new Map();
  for (const section of sections) {
    const key = `${section.source}\0${section.heading}`;
    sectionIds.set(key, [...(sectionIds.get(key) ?? []), section.id]);
  }
  const contracts = Object.fromEntries(semantics.contracts.map(contract => [contract.id, {
    sections: contract.docs.map(({ file, heading }) => {
      const matches = sectionIds.get(`${file}\0${plainHeading(heading)}`) ?? [];
      if (matches.length !== 1) {
        throw new Error(`Contract ${contract.id} must name one consumer section; ${file} "${heading}" matches ${matches.length}.`);
      }
      return matches[0];
    }),
    diagnostics: contract.diagnostics,
  }]));
  const known = ids => ids.map(id => {
    if (!Object.hasOwn(contracts, id)) { throw new Error(`Unknown API contract: ${id}`); }
    return id;
  });
  const members = (value, signatures = {}, mappings = {}) => Object.fromEntries(
    Object.entries(signatures).map(([name, signature]) => {
      if (!Object.hasOwn(mappings, name)) { throw new Error(`Missing member contracts: ${value.name}.${name}`); }
      const ids = known(mappings[name]);
      const primarySections = ids.flatMap(id => {
        const contract = semantics.contracts.find(item => item.id === id);
        const applicable = contract.docs.filter(doc => !doc.exports || doc.exports.includes(value.name));
        const specific = applicable.filter(doc => doc.members?.includes(name));
        const docs = specific.length ? specific : contract.members?.includes(name) ?
          applicable.filter(doc => !doc.members) : [];
        return docs.map(doc => sectionIds.get(`${doc.file}\0${plainHeading(doc.heading)}`)[0]);
      });
      return [name, { signature, contracts: ids, primarySections: [...new Set(primarySections)] }];
    }));
  const symbols = inventory.entrypoints.flatMap(entry => entry.exports.map(value => ({
    entrypoint: entry.name,
    name: value.name,
    kind: value.kind,
    signature: value.signature,
    contracts: known(value.contracts),
    ...value.kind === 'value' ? {
      static: members(value, value.members, value.memberContracts?.static),
    } : {
      members: members(value, value.members, value.memberContracts?.static),
    },
    instance: members(value, value.instance, value.memberContracts?.instance),
  })));
  return { schemaVersion: 2, contracts, symbols };
}

export function assertPrimarySections(index) {
  for (const symbol of index.symbols) {
    for (const key of ['static', 'instance', 'members']) {
      for (const [name, member] of Object.entries(symbol[key] ?? {})) {
        if (!member.primarySections.length) { throw new Error(`DOC_SYMBOL_ROUTE: ${symbol.name}.${name}`); }
      }
    }
  }
}
