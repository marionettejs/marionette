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
  const members = (signatures = {}, operations = {}, fallback) => Object.fromEntries(
    Object.entries(signatures).map(([name, signature]) =>
      [name, { signature, contracts: known(Object.hasOwn(operations, name) ? operations[name] : fallback) }]));
  const symbols = inventory.entrypoints.flatMap(entry => entry.exports.map(value => ({
    entrypoint: entry.name,
    name: value.name,
    kind: value.kind,
    signature: value.signature,
    contracts: known(value.contracts),
    ...value.kind === 'value' ? {
      static: members(value.members, value.operationContracts?.static, value.contracts),
    } : {
      members: members(value.members, value.operationContracts?.static, value.contracts),
    },
    instance: members(value.instance, value.operationContracts?.instance, value.contracts),
  })));
  return { schemaVersion: 1, contracts, symbols };
}
