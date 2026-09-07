import { View, CollectionView, Region, type ViewConfiguration, type BehaviorDefinition, type RegionDefinition } from '../tmp/typed-core/src/index.js';
import type { ViewLifecycle } from '../tmp/typed-core/src/modules/common/view.js';
import { mergeOptions, normalizeBindings, bindEvents, bindRequests } from '@marionette/utils';

const owner = { mergeOptions, bindEvents, bindRequests, listenTo() {} };
owner.mergeOptions({ title: 'Example' }, ['title']);
owner.mergeOptions(null);
normalizeBindings(owner, { ready() {} });
// @ts-expect-error Non-null options require an array of keys.
owner.mergeOptions({ title: 'Example' }, 'title');
// @ts-expect-error Non-null options require the keys argument.
owner.mergeOptions({ title: 'Example' });
// @ts-expect-error A binding map must be an object.
normalizeBindings(owner, 'ready');
// @ts-expect-error A truthy primitive is not an event binding map.
owner.bindEvents(new View(), 'ready');
// @ts-expect-error A truthy primitive is not a request binding map.
owner.bindRequests({ reply() {} }, true);

const view = new View({ el: document.createElement('div'), template: false });
const region = new Region({ el: '#host' });
region.show(view);
new CollectionView({ childView: View, emptyView: () => false });
// @ts-expect-error Views take elements, not selector strings.
new View({ el: '#host' });
// @ts-expect-error Regions take a selector or element, not arrays.
new Region({ el: [] });
// @ts-expect-error Region.show takes an instance, not a class.
region.show(View);
// @ts-expect-error Region.show takes an instance, not template text.
region.show('content');
// @ts-expect-error Behavior options require a constructor.
const invalidBehavior: BehaviorDefinition = { behaviorClass: false };
// @ts-expect-error Region definitions must match the documented union.
const invalidRegion: RegionDefinition = 123;
// @ts-expect-error Event maps are configured with objects or map factories.
const invalidModelEvents: ViewConfiguration = { modelEvents: 'ready' };
// @ts-expect-error Collection event maps are configured with objects or map factories.
const invalidCollectionEvents: ViewConfiguration = { collectionEvents: true };
// @ts-expect-error State event maps are configured with objects or map factories.
const invalidStateEvents: ViewConfiguration = { stateEvents: 1 };
// @ts-expect-error View classes and resolvers are the supported childView alternatives.
new CollectionView({ childView: {} });
// @ts-expect-error An emptyView resolver returns a View class or a supported absent value.
new CollectionView({ emptyView: () => 123 });
// @ts-expect-error Filters are functions, attribute names, or predicate objects.
new CollectionView({ viewFilter: true });

const lifecycle: ViewLifecycle = view;
const children: readonly ViewLifecycle[] = lifecycle._getImmediateChildren();
// @ts-expect-error Private lifecycle traversal always receives a child array.
const invalidLifecycle: ViewLifecycle = { ...view, _getImmediateChildren: () => ({ length: 0 }) };
