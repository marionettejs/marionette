import View, {type ViewConstructor} from '../tmp/typed-core/src/modules/view.js';
import Behavior from '../tmp/typed-core/src/modules/behavior.js';
import Region, {type RegionInstance} from '../tmp/typed-core/src/modules/region.js';
import type {SupportedView} from '../tmp/typed-core/src/modules/common/view.js';

const Button = View.extend({
  tagName: 'button',
  initialize(options: {label: string}) { this.options.label.toUpperCase(); },
  createState() { return {pressed: false}; },
  onClick(event: MouseEvent) { event.preventDefault(); this.getState().pressed = true; },
  events: {'click': 'onClick'},
  label() { return this.options.label; }
});
const button = new Button({label: 'Open'});
const label: string = button.label();
const pressed: boolean = button.getState().pressed;
const sameButton: typeof button = button.render().renderAttributes().delegateEvents().destroy();
// @ts-expect-error The declared initialize options are required.
new Button();
// @ts-expect-error The declared option is a string.
new Button({label: 123});
// @ts-expect-error The inferred factory state does not have this field.
button.getState().missing;

class NativeButton extends Button {
  label() { return super.label().toUpperCase(); }
  render() { return super.render(); }
}
const native = new NativeButton({label: 'Native'});
const nativeLabel: string = native.label();

const root = new View({el: document.createElement('main')});
const region = root.addRegion('content', {el: '.content'});
const shown: typeof button = root.showChildView('content', button);
const maybeChild: SupportedView | undefined = root.detachChildView('content');
const maybeRegion = root.getRegion('missing');
// @ts-expect-error An absent named region returns undefined.
const definiteRegion: RegionInstance = maybeRegion;
// @ts-expect-error Views require an already resolved element.
new View({el: '#root'});
new Region({el: '#root'});
const sameRegion: RegionInstance | undefined = region.show(button);
// @ts-expect-error Children need a supported lifecycle, not just a render function.
region.show({render() {}});
const noRegions = root.addRegions({});
// @ts-expect-error Empty region definitions can return undefined.
const definiteRegions: Record<string, RegionInstance> = noRegions;
const query: ArrayLike<Element> = root.$('button');
// @ts-expect-error Mutable global registration does not promise NodeList methods.
root.$('button').item(0);
// @ts-expect-error UI keys may be unbound or absent.
const boundUI: ArrayLike<Element> = root.getUI('button');

const FocusBehavior = Behavior.extend({
  initialize(options: {active: boolean}) { this.options.active.valueOf(); },
  events: {'focus': 'onFocus'},
  onFocus(event: FocusEvent) { this.view.triggerMethod('focused', event); },
  createState() { return {focused: false}; }
});
const host = Object.assign(root, {_removeBehavior() {}, customHostMethod() {return 'host';}});
const behavior = new FocusBehavior({active: true}, host);
const hostValue: string = behavior.view.customHostMethod();
const focused: boolean = behavior.getState().focused;
const sameBehavior: typeof behavior = behavior.bindUIElements().undelegateEntityEvents().destroy();
// @ts-expect-error The host is mandatory even when initialize only names options.
new FocusBehavior({active: true});
// @ts-expect-error An arbitrary object does not supply the host lifecycle/query methods.
new FocusBehavior({active: true}, {});
// @ts-expect-error Behavior is not a rendering View.
behavior.render();
const WithBehavior = View.extend({behaviors: [FocusBehavior]});
new WithBehavior();

interface NativeQuery extends ArrayLike<Element> { item(index: number): Element | null }
const ConfiguredView = View as ViewConstructor<{}, [options?: {el?: Element}], unknown, {}, NativeQuery>;
const configured = new ConfiguredView();
const first: Element | null = configured.$('button').item(0);

class NativeView extends View {
  render() { return super.render(); }
}
const nativeView = new NativeView();
const fluentNative: NativeView = nativeView.render();

new Behavior(undefined, root);

const normalizedEvents: Record<string, string> = root.normalizeUIKeys({'click @ui.button': 'onClick'}, {button: 'button'});
root.normalizeUIKeys(null, {button: 'button'});
root.normalizeUIValues({content: {el: '@ui.button'}}, 'el', {button: 'button'});
behavior.normalizeUIKeys(undefined, {button: 'button'});
behavior.normalizeUIValues({content: '@ui.button'}, undefined, {button: 'button'});
