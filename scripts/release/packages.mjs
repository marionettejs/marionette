export const releasePackages = Object.freeze([
  { id: 'utils', name: '@marionette/utils', directory: 'packages/utils' },
  { id: 'radio', name: '@marionette/radio', directory: 'packages/radio' },
  { id: 'core', name: 'marionette', directory: '.' },
  { id: 'data', name: '@marionette/data', directory: 'packages/data' },
  { id: 'adapters', name: '@marionette/adapters', directory: 'packages/adapters' },
].map(configuration => Object.freeze({
  ...configuration,
  manifestFile: `${configuration.id}-package-manifest.json`,
})));

export function validatePackageInventory(packages) {
  if (!Array.isArray(packages) || packages.length !== releasePackages.length ||
      packages.some((entry, index) => entry?.id !== releasePackages[index].id)) {
    throw new Error('Unexpected release package order: expected utils, radio, core, data, adapters.');
  }
  for (const [index, entry] of packages.entries()) {
    if (entry.name !== releasePackages[index].name) {
      throw new Error(`${entry.id} package name mismatch: ${entry.name}.`);
    }
  }
}
