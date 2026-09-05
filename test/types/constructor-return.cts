import MnObject from '../tmp/typed-core/src/modules/object.js';
import View from '../tmp/typed-core/src/modules/view.js';
import Behavior from '../tmp/typed-core/src/modules/behavior.js';
import Region from '../tmp/typed-core/src/modules/region.js';
import CollectionView from '../tmp/typed-core/src/modules/collection-view.js';
import Application from '../tmp/typed-core/src/modules/application.js';

const Identity = MnObject.extend({
  constructor: function<Receiver extends object>(this: Receiver, options: {label: string}): Receiver {
    MnObject.call(this, options);
    return this;
  },
  read(): string {return this.options.label;}
});
const normal: string = new Identity({label: 'Example'}).read();
interface Counter {count: number;}
const Counted = MnObject.extend({
  count: 0,
  constructor: function<Receiver extends Counter>(this: Receiver): Receiver {
    MnObject.call(this);
    this.count += 1;
    return this;
  }
});
const CountedChild = Counted.extend({extra(): boolean {return true;}});
const counted: boolean = new CountedChild().extra();
const Descendant = Identity.extend({extra(): boolean {return true;}});
const descendant: boolean = new Descendant({label: 'Example'}).extra();
// @ts-expect-error An unrelated object cannot implement an exact generic receiver return.
const invalidIdentity: <Receiver extends object>(this: Receiver) => Receiver = function() {return {token: 'replacement'};};

const Replacement = MnObject.extend({
  constructor: function() {return {token: 'replacement'};},
  read(): string {return 'prototype';}
});
const token: string = new Replacement().token;
// @ts-expect-error The replacement lacks the ordinary prototype method.
new Replacement().read();
const ReplacedDescendant = Replacement.extend({extra(): boolean {return true;}});
const inheritedToken: string = new ReplacedDescendant().token;
// @ts-expect-error Forwarding constructors retain the parent's replacement result.
new ReplacedDescendant().extra();
const Restored = ReplacedDescendant.extend({
  constructor: function<Receiver extends object>(this: Receiver): Receiver {
    MnObject.call(this);
    return this;
  }
});
const restored: boolean = new Restored().extra();

const Implicit = MnObject.extend({
  constructor: function() {MnObject.call(this); return this;},
  read(): string {return 'prototype';}
});
// @ts-expect-error Inferred return-this is ambiguous with conditional replacement.
new Implicit().read();
const Conditional = MnObject.extend({
  constructor: function(replace: boolean) {return replace ? {token: 'replacement'} : this;},
  read(): string {return 'prototype';}
});
// @ts-expect-error The replacement branch cannot promise prototype members.
new Conditional(true).read();
const Opaque = MnObject.extend({constructor: function(): unknown {return {token: 'replacement'};}});
// @ts-expect-error An explicitly unknown result remains unknown.
new Opaque().cid;

interface Fixed {token: string;}
const FixedResult = MnObject.extend({constructor: function(): Fixed {return {token: 'fixed'};}});
const FixedDescendant = FixedResult.extend({extra(): boolean {return true;}});
const fixed: string = new FixedDescendant().token;
// @ts-expect-error A fixed return interface is not a polymorphic receiver contract.
new FixedDescendant().extra();
const Optional = MnObject.extend({
  constructor: function(replace: boolean): Fixed | undefined {
    if (replace) {return {token: 'replacement'};}
    MnObject.call(this);
  },
  read(): string {return 'ordinary';}
});
const optional = new Optional(false);
const narrowed: string = 'token' in optional ? optional.token : optional.read();
// @ts-expect-error A possible replacement requires narrowing before prototype access.
optional.read();

// Void/primitive return types declare non-replacement construction; erased
// external return information cannot independently prove that caller contract.
const Primitive = MnObject.extend({constructor: function() {MnObject.call(this); return 0;}});
const primitiveId: string = new Primitive().cid;
declare const ordinaryVoid: () => void;
const VoidResult = MnObject.extend({constructor: ordinaryVoid});
const ordinaryId: string = new VoidResult().cid;

const ViewReplacement = View.extend({constructor: function() {return {viewToken: 1};}});
const viewToken: number = new ViewReplacement().viewToken;
// @ts-expect-error View replacement does not inherit render.
new ViewReplacement().render();
const BehaviorReplacement = Behavior.extend({constructor: function() {return {behaviorToken: 1};}});
const behaviorToken: number = new BehaviorReplacement().behaviorToken;
// @ts-expect-error Behavior replacement does not inherit its host property.
new BehaviorReplacement().view;
const RegionReplacement = Region.extend({constructor: function() {return {regionToken: 1};}});
const regionToken: number = new RegionReplacement().regionToken;
// @ts-expect-error Region replacement does not inherit show.
new RegionReplacement().show(new View());
const CollectionReplacement = CollectionView.extend({constructor: function() {return {collectionToken: 1};}});
const collectionToken: number = new CollectionReplacement().collectionToken;
// @ts-expect-error CollectionView replacement does not inherit children.
new CollectionReplacement().children;
const ApplicationReplacement = Application.extend({constructor: function() {return {applicationToken: 1};}});
const applicationToken: number = new ApplicationReplacement().applicationToken;
// @ts-expect-error Application replacement does not inherit asynchronous lifecycle.
new ApplicationReplacement().start();

const ViewIdentity = View.extend({
  constructor: function<Receiver extends object>(this: Receiver): Receiver {View.call(this); return this;}
});
const ViewChild = ViewIdentity.extend({label(): string {return 'child';}});
const viewLabel: string = new ViewChild().label();
const AppIdentity = Application.extend({
  constructor: function<Receiver extends object>(this: Receiver): Receiver {Application.call(this); return this;}
});
const AppChild = AppIdentity.extend({label(): string {return 'child';}});
const started: Promise<boolean> = new AppChild().start();
const appLabel: string = new AppChild().label();
