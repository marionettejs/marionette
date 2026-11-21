import SkeletorApi from '@mnjs/adapters/skeletor';
import { Model, Collection } from '@converse/skeletor';
import type { EventCallbackMap } from '@converse/skeletor';
import { createMarionette } from 'marionette';

class Item extends Model<{ id: number; title: string }> {
  description() { return this.attrs.title; }
}
const model = new Item({ id: 1, title: 'First' });
const collection = new Collection<Item>([model]);
const models: Item[] = SkeletorApi.models(collection);
const key: string = SkeletorApi.key(model);
const value: unknown = SkeletorApi.get(model, 'title');
const present: boolean = SkeletorApi.has(model, 'title');
const snapshot: Record<string, unknown> = SkeletorApi.serialize(model);
const handler = (changed: Item, title: string) => title.toUpperCase();
const events: EventCallbackMap = { 'change:title': handler };
const context = {};
const stop: () => void = SkeletorApi.subscribe(model, 'change:title', handler, context);
SkeletorApi.subscribe(model, events, context)();
SkeletorApi.subscribe(model, events, undefined, context)();
const eventNames: string | EventCallbackMap = Math.random() ? 'change:title' : events;
SkeletorApi.subscribe(model, eventNames, handler)();
SkeletorApi.observeCollection(collection, () => {}, context)();
SkeletorApi.disposeOwned(model);
const runtime = createMarionette();
runtime.setDataApi(SkeletorApi);
runtime.setStateApi(SkeletorApi);
runtime.View.setDataApi(SkeletorApi);
runtime.CollectionView.setDataApi(SkeletorApi);
runtime.MnObject.setStateApi(SkeletorApi);
// @ts-expect-error A model is required.
SkeletorApi.get({}, 'title');
// @ts-expect-error An actual collection is required.
SkeletorApi.models([model]);
// @ts-expect-error String events require a callback.
SkeletorApi.subscribe(model, 'change', 123);
void [models, key, value, present, snapshot, stop];
