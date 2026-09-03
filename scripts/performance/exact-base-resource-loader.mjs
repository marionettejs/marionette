import { resolve as resolvePath } from 'node:path';
import { pathToFileURL } from 'node:url';

const relocatedBackboneUrl = pathToFileURL(resolvePath('dist/backbone.js')).href;
const bridgeUrl = new URL('./base-resource-backbone.mjs', import.meta.url).href;

export function resolve(specifier, context, nextResolve) {
  if (specifier === relocatedBackboneUrl) {
    return { shortCircuit: true, url: bridgeUrl };
  }

  return nextResolve(specifier, context);
}
