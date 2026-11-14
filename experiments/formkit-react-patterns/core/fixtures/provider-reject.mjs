const controls = globalThis.__formKitProviderFixtures;
controls.enter(import.meta.url);
await controls.wait(import.meta.url);
throw new Error('Controlled config rejection');
