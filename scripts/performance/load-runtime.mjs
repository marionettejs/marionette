import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function loadBackboneRuntime(root, dependencyRoot = root) {
  const requireFromRoot = createRequire(resolve(dependencyRoot, 'package.json'));
  const Backbone = requireFromRoot('backbone');
  const [Marionette, { default: BackboneApi }] = await Promise.all([
    import(pathToFileURL(resolve(root, 'dist/marionette.js')).href),
    import(pathToFileURL(resolve(root, 'packages/adapters/dist/backbone.js')).href),
  ]);

  Marionette.setDataApi(BackboneApi);
  Marionette.setStateApi(BackboneApi);

  return { Backbone, Marionette };
}
