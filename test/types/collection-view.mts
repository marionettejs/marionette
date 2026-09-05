import CollectionView, {type CollectionViewInstance, type CollectionChild} from '../tmp/typed-core/src/modules/collection-view.js';
import View from '../tmp/typed-core/src/modules/view.js';
import type {Events} from '../tmp/typed-core/src/mixins/events.js';
import type {RegionInstance} from '../tmp/typed-core/src/modules/region.js';

interface Row {id: number; label: string;}
const rows: Row[] = [{id: 1, label: 'Example'}];
const Item = View.extend({
  initialize(options: {model: Row}) {},
  label(): string {return this.options.model.label;}
});
const Empty = View.extend({ emptyLabel(): string {return 'Nothing here';} });
const direct = new CollectionView({collection: rows, childView: Item});
const directLabel: string | undefined = direct.children.first()?.label();
const directModels: Row[] | undefined = direct.collection;
const List = CollectionView.extend({
  collection: rows,
  childView: Item,
  emptyView: Empty,
  childViewContainer: '.items',
  template: '<div class="items"></div>',
  childViewOptions(model: Row) {return {title: model.label};},
  viewFilter(view: InstanceType<typeof Item>, index: number, children: InstanceType<typeof Item>[]) {return view.label().length > index && children.includes(view);},
  total(): number {
    const childLabel: string | undefined = this.children.first()?.label();
    return this.children.length;
  }
});
const list = new List();
const labels: string[] = list.children.map(view => view.label());
const firstLabel: string | undefined = list.children.findByModel(rows[0])?.label();
const count: number = list.total();
list.setComparator(view => view.label());
list.setComparator((left, right) => left.label().localeCompare(right.label()));
list.setComparator('label', {preventRender: true});
list.removeComparator();
list.setFilter(function(view, index, children) {return view.label().length > index && children.length > 0;});
list.setFilter({id: 1});
list.setFilter('label');
list.setFilter(false, {preventRender: true});
list.removeFilter();
list.setFilter(function(view) {return this.total() > 0 && view.label().length > 0;});
const compared: typeof list = list.setComparator(view => view.label());
const sorted: typeof list = list.sort();
const filtered: typeof list = list.filter();
const region: RegionInstance = list.getEmptyRegion();
region.currentView?.render();
const row = new Item({model: rows[0]});
const added: typeof row = list.addChildView(row, 1, {preventRender: true});
const addedOptions: typeof row = list.addChildView(row, {index: 0, preventRender: true});
const detached: typeof row = list.detachChildView(row);
const removed: typeof row = list.removeChildView(row);
const absent: undefined = list.removeChildView(undefined);
const nullChild: null = list.addChildView(null);
const returned: typeof row = list.buildChildView(rows[0], Item, {});
const ExtendedList = List.extend({second(): number {return this.total();}});
const extendedLabel: string | undefined = new ExtendedList().children.first()?.label();
const overridden = new List({childView: Empty});
const emptyLabel: string | undefined = overridden.children.first()?.emptyLabel();
const overriddenClass: typeof Empty = overridden.childView;
const inherited = new List({childView: undefined});
const inheritedClass: typeof Item = inherited.childView;
const inheritedLabel: string | undefined = inherited.children.first()?.label();
declare const optionalOptions: {readonly childView?: typeof Empty};
const optional = new List(optionalOptions);
const possibleClass: typeof Item | typeof Empty = optional.childView;
const possibleChild: InstanceType<typeof Item> | InstanceType<typeof Empty> | undefined = optional.children.first();
const defaultSorting: boolean = new CollectionView({sortWithCollection: undefined}).sortWithCollection;
const literal = new List({childView: Empty, childViewContainer: '.empty'} as const);
const literalContainer: '.empty' = literal.childViewContainer;
declare const Foreign: new() => Pick<Events, 'on' | 'off' | 'triggerMethod'> & {
  cid: string; el: HTMLElement; render(): void; remove(): void; marker(): boolean;
};
const foreignList = new CollectionView({childView: Foreign});
const foreignMarker: boolean | undefined = foreignList.children.first()?.marker();
const opaqueSource = {records: rows};
const opaque = new CollectionView({collection: opaqueSource, childView: Item});
const opaqueRecords: Row[] | undefined = opaque.collection?.records;
const manual = new CollectionView();
const manualAdded: typeof row = manual.addChildView(row);
manual.detachChildView(row);
manual.addChildView(new Empty());
const FactoryList = CollectionView.extend({
  childView(model: Row) {return Item;},
  childViewOptions(model: Row) {return {title: model.label};}
});
const factory = new FactoryList({collection: rows});
const directFactory = new CollectionView({childView(model: Row) {return Item;}});
const directFactoryLabel: string | undefined = directFactory.children.first()?.label();
const factoryLabel: string | undefined = factory.children.findByIndex(0)?.label();
const Native = class extends List {nativeCount(): number {return this.total();}};
const native = new Native({childView: Empty});
const nativeChild: CollectionChild | undefined = native.children.first();
const nativeCount: number = native.nativeCount();
declare const declared: CollectionViewInstance<InstanceType<typeof Item>>;
const declaredLabel: string | undefined = declared.children.first()?.label();

// @ts-expect-error The supplied copied class replaces the prototype class property.
const wrongClass: typeof Item = overridden.childView;
// @ts-expect-error Optional copied options preserve both possible classes.
const uncertainClass: typeof Empty = optional.childView;
// @ts-expect-error Filter receivers are the CollectionView instance.
list.setFilter(function(this: {unrelated: true}, view) {return view.label();});
// @ts-expect-error Supplied childView overrides the inherited child type.
overridden.children.first()?.label();
// @ts-expect-error CollectionView does not compose RegionsMixin.
list.addRegion('main', '.main');
// @ts-expect-error CollectionView has child instances, not named View regions.
list.showChildView('main', row);
// @ts-expect-error Detach takes a child instance, not a region name.
list.detachChildView('main');
// @ts-expect-error Known child containers retain the declared child methods.
const wrongLabel: number = list.children.first()!.label();
// @ts-expect-error A configured Item list does not silently accept incompatible children.
list.addChildView(new Empty());
// @ts-expect-error Child configuration requires a constructor, not an instance.
new CollectionView({childView: row});
// @ts-expect-error A child factory must return a constructor.
new CollectionView({childView() {return {cid: 'bad'};}});
// @ts-expect-error Filters receive child views, not collection models.
list.setFilter((model: Row) => model.id);
// @ts-expect-error Filters reject array shorthand.
list.setFilter(['label']);
// @ts-expect-error A binary comparator returns a number.
list.setComparator((left, right) => left.label());
// @ts-expect-error Comparator replacement takes a callable or property name.
list.setComparator({label: 1});
// @ts-expect-error Manual insertion options use numeric indexes.
list.addChildView(row, {index: 'first'});
// @ts-expect-error An empty region does not promise the ordinary child type.
region.currentView?.label();
