import Behavior from '../tmp/typed-core/src/modules/behavior.js';
import View from '../tmp/typed-core/src/modules/view.js';
import CollectionView from '../tmp/typed-core/src/modules/collection-view.js';

const root = document.createElement('section');
const view = new View({ el: root });
const collectionView = new CollectionView({ el: () => root });
const extended = new (View.extend({ template: false }))({ el: root });
class NativeView extends View {}
const native = new NativeView({ el: root });
const factory = new (View.extend({ el: () => root }))();
const collectionFactory = new (CollectionView.extend({ el: () => root }))();
for (const instance of [view, collectionView, extended, native, factory, collectionFactory]) {
  const element: Element = instance.el;
  element.setAttribute('title', 'Mutable contents, fixed identity');
  // @ts-expect-error A View keeps its initial element.
  instance.el = document.createElement('div');
  // @ts-expect-error Root replacement is no longer a public operation.
  instance.setElement(root);
}

const behavior = new Behavior({}, view);
// @ts-expect-error A Behavior shares its host's fixed root.
behavior.el = root;
// @ts-expect-error Behavior element retargeting is removed.
behavior._syncElement();

new View({ id: null, className: () => null }).renderAttributes();
new CollectionView({ id: () => undefined, className: null }).renderAttributes();
view.id = () => null;
view.className = () => undefined;
collectionView.id = null;
collectionView.className = () => null;
// @ts-expect-error Root attributes remain strings, null, or undefined.
view.id = 42;
// @ts-expect-error A className callback cannot return a boolean.
collectionView.className = () => false;
