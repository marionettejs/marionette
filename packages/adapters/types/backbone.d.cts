import Backbone = require('backbone');

declare const BackboneApi: {
  key(model: Backbone.Model): string;
  get(model: Backbone.Model, attribute: string): unknown;
  has(model: Backbone.Model, attribute: string): boolean;
  serialize(model: Backbone.Model): Backbone.ObjectHash;
  models<TModel extends Backbone.Model>(collection: Backbone.Collection<TModel>): TModel[];
  subscribe(
    entity: Backbone.Events,
    events: Backbone.EventMap,
    context?: unknown,
    explicitContext?: unknown,
  ): () => void;
  subscribe(
    entity: Backbone.Events,
    eventName: string | Backbone.EventMap,
    callback?: Backbone.EventHandler,
    context?: unknown,
  ): () => void;
  disposeOwned(source: Backbone.Events): void;
  observeCollection(
    collection: Backbone.Collection,
    callback: (change: unknown) => void,
    context?: unknown,
  ): () => void;
};

export = BackboneApi;
