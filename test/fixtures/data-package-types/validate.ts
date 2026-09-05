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

// Opaque event registration accepts typed callbacks without promising payload validation.
const countHandler = (count: number) => count.toFixed();
const context = { source: 'fixture' };
model.on('count', countHandler);
const eventName: string | Record<string, typeof countHandler> = Math.random() ? 'count' : { count: countHandler };
model.on(eventName, countHandler);
model.once(eventName, countHandler);
model.once({ count: countHandler }, context);
model.off({ count: countHandler }, context);
model.listenTo(collection, { count: countHandler });
model.listenToOnce(collection, 'count', countHandler);
model.stopListening(collection, { count: countHandler });
collection.stopListening(model, { count: countHandler }, countHandler);
model.stopListening(null, null, null);
model.trigger({ count: 1 });
DataApi.subscribe(model, 'count', countHandler);
StateApi.subscribe(collection, 'count', countHandler);
const borrowed = { trigger(name: string, value: number) { return name + value; } };
triggerMethod.call(borrowed, 'count', 1);
model.triggerMethod.call(borrowed, 'count', 1);
// @ts-expect-error Registration requires a callable handler.
model.on('count', 123);
// @ts-expect-error A map entry must be callable.
model.stopListening(collection, { count: 123 });
// @ts-expect-error The borrowed helper requires a callable trigger.
triggerMethod.call({}, 'count');
// @ts-expect-error The instance helper has the same receiver requirement.
model.triggerMethod.call({}, 'count');
// @ts-expect-error A constructor-only value cannot handle triggered events.
model.on('count', class CountHandler {});

const Named = Model.extend({ label() { return String(this.get('label')); } }, {
  category() { return 'named'; }
});
const named = new Named({ label: 'example' });
const namedLabel: string = named.label();
const inferredAttribute: string | undefined = named.get('label');
const Child = Named.extend({ active() { return true; } }, { category() { return 1; } });
const child = new Child({ label: 'child' });
const inheritedLabel: string = child.label();
const active: boolean = child.active();
const category: number = Child.category();
// @ts-expect-error Static replacement removes its earlier result type.
const previousCategory: string = Child.category();
// @ts-expect-error The extension does not invent arbitrary methods.
child.missing();
const Custom = Model.extend({
  constructor: function<Receiver extends Model>(this: Receiver, attributes: { label: string }, suffix: string): Receiver {
    Model.call(this, { label: attributes.label + suffix });
    return this;
  },
  label() { return String(this.get('label')); }
});
const CustomChild = Custom.extend({ active() { return true; } });
const custom = new CustomChild({ label: 'custom' }, '!');
const customLabel: string = custom.label();
const customActive: boolean = custom.active();
// @ts-expect-error The descendant retains the custom constructor's required argument.
new CustomChild({ label: 'custom' });

class TypedModel extends Model<Attributes> {
  upperLabel() { return this.get('label')?.toUpperCase(); }
}
const typed = new TypedModel({ label: 'typed' });
const upperLabel: string | undefined = typed.upperLabel();
// @ts-expect-error Direct native subclass construction retains its attributes.
new TypedModel({ label: 123 });
// @ts-expect-error Default extension calls parent.apply, which cannot invoke a native class.
TypedModel.extend({ label() { return 'invalid'; } });
const ExplicitNative = TypedModel.extend({ constructor: function() { return { replacement: 'native' }; } });
const explicitNative: string = new ExplicitNative().replacement;
class TypedCollection extends Collection<Model<Attributes>> {}
const typedCollection = new TypedCollection([typed]);
const typedFirst: Model<Attributes> | undefined = typedCollection.at(0);
// @ts-expect-error Default extension cannot invoke a native Collection subclass with apply.
TypedCollection.extend({ title() { return 'invalid'; } });
const ExplicitNativeCollection = TypedCollection.extend({ constructor: function() { return { replacement: 'native collection' }; } });
const explicitNativeCollection: string = new ExplicitNativeCollection().replacement;
const sameModelConstructor: typeof Model = Model;
const sameCollectionConstructor: typeof Collection = Collection;
const maybeModel: unknown = model;
if (maybeModel instanceof Model) {
  const nativeId: unknown = maybeModel.id;
}
const maybeCollection: unknown = collection;
if (maybeCollection instanceof Collection) {
  const nativeLength: number = maybeCollection.length;
}

const NamedCollection = Collection.extend({ title() { return 'items'; } }, { sizeLabel() { return 'large'; } });
const namedCollection = new NamedCollection([named]);
const title: string = namedCollection.title();
const inferredModel: typeof named | undefined = namedCollection.at(0);
const CollectionChild = NamedCollection.extend({ ready() { return true; } }, { sizeLabel() { return 2; } });
const collectionChild = new CollectionChild();
const inheritedTitle: string = collectionChild.title();
const ready: boolean = collectionChild.ready();
const sizeLabel: number = CollectionChild.sizeLabel();
// @ts-expect-error Collection static replacement removes the former result type.
const oldSizeLabel: string = CollectionChild.sizeLabel();
// @ts-expect-error Collection extension does not invent arbitrary methods.
collectionChild.missing();

const Relabeled = Child.extend({ label() { return 1; } });
const relabeled: number = new Relabeled().label();
// @ts-expect-error Instance replacement removes its earlier result type.
const previousLabel: string = new Relabeled().label();
const CustomCollection = Collection.extend({
  constructor: function<Receiver extends Collection & { label: string }>(this: Receiver, models: Model[], label: string): Receiver {
    Collection.call(this, models);
    this.label = label;
    return this;
  },
  label: '',
  title() { return this.label; }
});
const CustomCollectionChild = CustomCollection.extend({ ready() { return true; } });
const customCollection = new CustomCollectionChild([model], 'items');
const customTitle: string = customCollection.title();
const customReady: boolean = customCollection.ready();
// @ts-expect-error Collection descendants retain required custom constructor arguments.
new CustomCollectionChild([model]);

const ReplacementModel = Model.extend({
  constructor: function() { return { replacement: 'model' }; }
});
const replacementModel: string = new ReplacementModel().replacement;
// @ts-expect-error An explicit replacement object is not a Model.
new ReplacementModel().get('label');
const ReplacementChild = ReplacementModel.extend({ label() { return 'unused'; } });
// @ts-expect-error Inherited replacement construction does not install child instance methods.
new ReplacementChild().label();
const ReplacementCollection = Collection.extend({
  constructor: function() { return { replacement: 'collection' }; }
});
const replacementCollection: string = new ReplacementCollection().replacement;
// @ts-expect-error An explicit replacement object is not a Collection.
new ReplacementCollection().at(0);
const unknownConstructor = function(): unknown { return { replacement: true }; };
const UnknownModel = Model.extend({ constructor: unknownConstructor });
const unknownModel: unknown = new UnknownModel();
// @ts-expect-error An unknown return cannot promise a Model.
new UnknownModel().get('label');
const ImplicitReceiver = Model.extend({
  constructor: function() { Model.call(this); return this; }
});
const ImplicitChild = ImplicitReceiver.extend({ label() { return 'child'; } });
// @ts-expect-error An inferred fixed receiver return does not promise later child methods.
new ImplicitChild().label();
const PrimitiveModel = Model.extend({
  constructor: function(): number { Model.call(this); return 1; },
  label() { return 'ordinary'; }
});
const primitiveLabel: string = new PrimitiveModel().label();

const source = {
  on(name: string, callback?: (...args: unknown[]) => unknown) {},
  off(name?: string | null, callback?: ((...args: unknown[]) => unknown) | null) {}
};
model.listenTo(source, 'count', countHandler);
model.stopListening(source, { count: countHandler });
DataApi.subscribe(source, 'count', countHandler);
StateApi.subscribe(source, 'count', countHandler);
// @ts-expect-error Sources must provide both on and off.
model.listenTo({ on() {} }, 'count', countHandler);
// @ts-expect-error Source subscription requires a callback.
DataApi.subscribe(source, 'count');

const UnknownCollection = Collection.extend({ constructor: unknownConstructor });
// @ts-expect-error An unknown return cannot promise a Collection.
new UnknownCollection().at(0);
const AnyModel = Model.extend({ constructor: function() { return JSON.parse('{}'); } });
// @ts-expect-error An any return is conservatively unknown, not a promised Model.
new AnyModel().get('label');
const VoidModel = Model.extend({ constructor: function(): void { Model.call(this); } });
const voidModelDestroyed: boolean = new VoidModel().isDestroyed();
const ConditionalCollection = Collection.extend({
  constructor: function<Receiver extends Collection>(this: Receiver, replace: boolean): Receiver | { replacement: true } {
    if (replace) { return { replacement: true }; }
    Collection.call(this);
    return this;
  }
});
const conditional = new ConditionalCollection(false);
if ('replacement' in conditional) {
  const replaced: true = conditional.replacement;
} else {
  const length: number = conditional.length;
}
// @ts-expect-error A conditional replacement must be narrowed before Collection operations.
new ConditionalCollection(true).at(0);

const OrdinaryModel = Model.extend({ label() { return 'ordinary'; } });
const maybeOrdinary: unknown = new OrdinaryModel();
if (maybeOrdinary instanceof OrdinaryModel) {
  const ordinaryLabel: string = maybeOrdinary.label();
}
const OrdinaryCollection = Collection.extend({ title() { return 'ordinary'; } });
const maybeOrdinaryCollection: unknown = new OrdinaryCollection();
if (maybeOrdinaryCollection instanceof OrdinaryCollection) {
  const ordinaryTitle: string = maybeOrdinaryCollection.title();
}

// A configured model can replace an input instance; options can replace it again.
class InputModel extends Model { inputOnly() { return 'input'; } }
class ConfiguredModel extends Model { configuredOnly() { return 'configured'; } }
class OptionModel extends Model { optionOnly() { return 'option'; } }
const ConfiguredCollection = Collection.extend({model: ConfiguredModel});
const configuredCollection = new ConfiguredCollection([new InputModel()]);
// @ts-expect-error The input can be converted to the configured model class.
configuredCollection.at(0)!.inputOnly();
// @ts-expect-error Configured collections conservatively retain possible constructor model overrides.
configuredCollection.at(0)!.configuredOnly();
const configuredFirst = configuredCollection.at(0);
if (configuredFirst instanceof ConfiguredModel) {
  const configuredValue: string = configuredFirst.configuredOnly();
}
const optionCollection = new ConfiguredCollection(undefined, {model: OptionModel});
const optionFirst = optionCollection.at(0);
if (optionFirst instanceof OptionModel) {
  const optionValue: string = optionFirst.optionOnly();
}
// @ts-expect-error options.model can replace the prototype model class.
optionCollection.at(0)!.configuredOnly();
// @ts-expect-error The instance model constructor reflects possible configuration replacement too.
new optionCollection.model().configuredOnly();
const ordinaryInput = new Collection([new InputModel()]);
const ordinaryValue: string = ordinaryInput.at(0)!.inputOnly();
const ordinaryOption = new Collection(undefined, {model: OptionModel});
const ordinaryOptionValue: string = ordinaryOption.at(0)!.optionOnly();
