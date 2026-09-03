import {
  Collection,
  DataApi,
  Model,
  StateApi,
  triggerMethod,
  type CollectionChange,
} from '@marionette/data';

type Attributes = { id: number; label: string };
const model = new Model<Attributes>({ id: 1, label: 'one' });
const collection = new Collection<Model<Attributes>>([model]);
const first: Model<Attributes> | undefined = collection.get(1);
const label: string | undefined = model.get('label');
const models: Array<Model<Attributes>> = DataApi.models(collection);
const stopCollection = DataApi.observeCollection(collection, (change: CollectionChange<Model<Attributes>>) => {
  const kind: 'reset' | 'reorder' | 'update' = change.kind;
  void kind;
});
const stopState = StateApi.subscribe(model, 'change:label', () => {});
const result: unknown = triggerMethod.call(model, 'fixture:event');

collection.add({ id: 2, label: 'two' });
model.set('label', 'ONE', { silent: true });
stopCollection();
stopState();

void first;
void label;
void models;
void result;
