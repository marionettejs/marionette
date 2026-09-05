import {MnObject, View, CollectionView, Region, Behavior, Application} from '../tmp/typed-core/src/index.js';

// Native subclasses remain directly constructible, but their inherited helper's
// default constructor cannot invoke an ES class through Parent.apply.
class NativeObject extends MnObject {}
class NativeView extends View {}
class NativeCollectionView extends CollectionView {}
class NativeRegion extends Region {}
class NativeBehavior extends Behavior {}
class NativeApplication extends Application {}

new NativeObject();
new NativeView();
new NativeCollectionView();
new NativeRegion({el: '#root'});
new NativeBehavior(undefined, new View());
new NativeApplication();

// @ts-expect-error Default extension forwards with Parent.apply, which cannot invoke a native class.
NativeObject.extend({});
// @ts-expect-error Default extension forwards with Parent.apply, which cannot invoke a native class.
NativeView.extend({});
// @ts-expect-error Default extension forwards with Parent.apply, which cannot invoke a native class.
NativeCollectionView.extend({});
// @ts-expect-error Default extension forwards with Parent.apply, which cannot invoke a native class.
NativeRegion.extend({});
// @ts-expect-error Default extension forwards with Parent.apply, which cannot invoke a native class.
NativeBehavior.extend({});
// @ts-expect-error Default extension forwards with Parent.apply, which cannot invoke a native class.
NativeApplication.extend({});

// Ordinary callable Marionette parents and extension chains retain their types.
const MnObjectChild = MnObject.extend({label(): string {return 'child';}}).extend({count(): number {return 1;}});
const MnObjectLabel: string = new MnObjectChild().label();
const MnObjectCount: number = new MnObjectChild().count();
const ViewChild = View.extend({label(): string {return 'child';}}).extend({count(): number {return 1;}});
const ViewLabel: string = new ViewChild().label();
const ViewCount: number = new ViewChild().count();
const CollectionViewChild = CollectionView.extend({label(): string {return 'child';}}).extend({count(): number {return 1;}});
const CollectionViewLabel: string = new CollectionViewChild().label();
const CollectionViewCount: number = new CollectionViewChild().count();
const RegionChild = Region.extend({label(): string {return 'child';}}).extend({count(): number {return 1;}});
const RegionLabel: string = new RegionChild({el: '#root'}).label();
const RegionCount: number = new RegionChild({el: '#root'}).count();
const BehaviorChild = Behavior.extend({label(): string {return 'child';}}).extend({count(): number {return 1;}});
const BehaviorLabel: string = new BehaviorChild(undefined, new View()).label();
const BehaviorCount: number = new BehaviorChild(undefined, new View()).count();
const ApplicationChild = Application.extend({label(): string {return 'child';}}).extend({count(): number {return 1;}});
const ApplicationLabel: string = new ApplicationChild().label();
const ApplicationCount: number = new ApplicationChild().count();

// An explicit own constructor bypasses the default Parent.apply branch.
const ReplacedNative = NativeObject.extend({
  constructor: function() {return {token: 'replacement'};}
});
const replacement: string = new ReplacedNative().token;
// @ts-expect-error The replacement result does not acquire the parent prototype.
new ReplacedNative().getState();
const ConstructedNative = NativeView.extend({
  constructor: function(): NativeView {return Reflect.construct(NativeView, []);}
});
const nativeView: NativeView = new ConstructedNative();
