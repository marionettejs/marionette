const controls = globalThis.__formKitProviderFixtures;
controls.enter(import.meta.url);
await controls.wait(import.meta.url);
controls.complete(import.meta.url);
const options = controls.options(import.meta.url);
export const config = options.config;
export const inputs = options.inputs;
export const plugins = options.plugins;
