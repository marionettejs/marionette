import Backbone from 'backbone';
import BackboneApi from '../../packages/adapters/dist/backbone.js';
import * as Marionette from '../../dist/marionette.js';

Marionette.setDataApi(BackboneApi);
Marionette.setStateApi(BackboneApi);

export default Backbone;
