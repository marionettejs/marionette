import { afterEach } from 'vitest';
import Backbone from 'backbone';
import { setDataApi } from '../../src/index.ts';
import BackboneApi from '../../packages/adapters/src/data/backbone.ts';

setDataApi(BackboneApi);

afterEach(() => {
  Backbone.history.stop();
  Backbone.history.handlers.length = 0;
});
