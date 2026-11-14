const controls = globalThis.__formKitProviderFixtures;
controls.enter(import.meta.url);
await controls.wait(import.meta.url);
controls.complete(import.meta.url);
export default controls.options(import.meta.url);
