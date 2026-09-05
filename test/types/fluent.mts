import View from '../tmp/typed-core/src/modules/view.js';
import Region from '../tmp/typed-core/src/modules/region.js';
import Behavior from '../tmp/typed-core/src/modules/behavior.js';
import CollectionView from '../tmp/typed-core/src/modules/collection-view.js';

const Item = View.extend({
  initialize(options: { label: string }) { options.label.toUpperCase(); },
  label(): string { return this.options.label; },
});
new Item({ label: 'Example' }).render().renderAttributes().bindUIElements().label();
new Item({ label: 'Example' }).delegateEvents().undelegateEvents().destroy().label();
class NativeItem extends Item {
  render(): this { return this; }
  destroy(): this { return this; }
  native(): boolean { return true; }
}
new NativeItem({ label: 'Example' }).render().destroy().native();
const Replaced = Item.extend({ render(): number { return 1; } });
const numeric: number = new Replaced({ label: 'Example' }).render();
// @ts-expect-error replacement render no longer returns the view
new Replaced({ label: 'Example' }).render().label();
class NativeReplaced extends Replaced { destroy(): this { return this; } }
// @ts-expect-error the inherited required argument is unchanged
new NativeReplaced();

const Area = Region.extend({
  initialize(options: { el: Element }) {},
  label(): string { return 'area'; },
});
new Area({ el: document.createElement('div') }).empty().reset().destroy().label();
new Area({ el: document.createElement('div') }).show(new Item({ label: 'Example' }))?.label();
class NativeArea extends Area { reset(): this { return this; } }
new NativeArea({ el: document.createElement('div') }).reset().label();
const Plugin = Behavior.extend({
  initialize(options: object) {},
  label(): string { return 'plugin'; },
});
new Plugin({}, new Item({ label: 'Example' })).bindUIElements().delegateEntityEvents().destroy().label();
class NativePlugin extends Plugin { destroy(): this { return this; } }
new NativePlugin({}, new Item({ label: 'Example' })).destroy().label();
const List = CollectionView.extend({ childView: Item, label(): string { return 'list'; } });
new List().render().renderAttributes().delegateEvents().destroy().label();
class NativeList extends List {
  render(): this { return this; }
  destroy(): this { return this; }
  native(): boolean { return true; }
}
new NativeList().render().destroy().native();
// @ts-expect-error a replacement method must retain its own result
const wrong: string = numeric;

const dynamic: Record<string, unknown> = { render() { return 42; } };
const DynamicView = View.extend(dynamic);
// @ts-expect-error dictionary overrides are unknown, not known fluent methods
new DynamicView().render();
const DynamicRegion = Region.extend(dynamic);
// @ts-expect-error a dictionary can replace any Region method
new DynamicRegion().empty();
const DynamicBehavior = Behavior.extend(dynamic);
// @ts-expect-error a dictionary can replace any Behavior method
new DynamicBehavior({}, new Item({ label: 'Example' })).destroy();
