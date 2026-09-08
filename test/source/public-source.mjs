import { registerHooks } from 'node:module';

// Source validation consumes the same public package names as applications.
// Only this loader maps package entrypoints to source instead of built outputs.
const entries = new Map([
  ['marionette', '../../src/index.ts'],
  ['@mnjs/utils', '../../packages/utils/src/index.ts'],
  ['@mnjs/radio', '../../packages/radio/src/index.ts'],
  ['@mnjs/adapters/backbone', '../../packages/adapters/src/data/backbone.ts'],
  ['@mnjs/adapters/dom/jquery', '../../packages/adapters/src/dom/jquery.ts']
]);

registerHooks({
  resolve(specifier, context, nextResolve) {
    const entry = entries.get(specifier);
    return entry ? { url: new URL(entry, import.meta.url).href, shortCircuit: true } :
      nextResolve(specifier, context);
  }
});
