// Marionette.extend
// -----------------

import setProperty from './set-property.ts';

import type { CallableParent, Constructed, Merge } from './constructor.ts';

type ParentInstance<Parent> = Parent extends new (...args: never[]) => infer Instance ? Instance :
  Parent extends (...args: never[]) => unknown ? unknown extends ThisParameterType<Parent>
    ? object : ThisParameterType<Parent> : object;
type ArgumentsFor<Parent, Props> = Props extends { constructor: (...args: infer Args) => unknown } ? Args :
  Parent extends (...args: infer Args) => unknown ? Args : never[];
type InstanceFor<Parent, Props> = Merge<ParentInstance<Parent>, Props>;
type ConstructorResult<Parent, Props> = Props extends { constructor: (...args: never[]) => infer Result } ? Result :
  Parent extends (...args: never[]) => infer Result ? Result : unknown;
type Extension<Parent, Props, Statics> = {
  new(...args: ArgumentsFor<Parent, Props>): Constructed<
    Props extends { constructor: (...args: never[]) => unknown } ? Props : { constructor: Parent },
    InstanceFor<Parent, Props>
  >;
  (this: InstanceFor<Parent, Props>, ...args: ArgumentsFor<Parent, Props>): ConstructorResult<Parent, Props>;
  prototype: InstanceFor<Parent, Props>;
  __super__: ParentInstance<Parent>;
} & Merge<Omit<Parent, 'prototype' | '__super__'>, Statics>;

interface Extend {
  <Parent extends Function & { prototype: object }, Props extends { constructor: (...args: never[]) => unknown }, Statics extends object = {}>(
    this: Parent, prototypeProperties: Props & ThisType<InstanceFor<Parent, Props>>,
    staticProperties?: Statics & ThisType<Extension<Parent, Props, Statics>>
  ): Extension<Parent, Props, Statics>;
  <Parent extends CallableParent, Props extends object = {}, Statics extends object = {}>(
    this: Parent, prototypeProperties?: Props & ThisType<InstanceFor<Parent, Props>>,
    staticProperties?: Statics & ThisType<Extension<Parent, Props, Statics>>
  ): Extension<Parent, Props, Statics>;
  call<Parent extends Function & { prototype: object }, Props extends { constructor: (...args: never[]) => unknown }, Statics extends object = {}>(
    this: Extend, parent: Parent, prototypeProperties: Props & ThisType<InstanceFor<Parent, Props>>,
    staticProperties?: Statics & ThisType<Extension<Parent, Props, Statics>>
  ): Extension<Parent, Props, Statics>;
  call<Parent extends CallableParent, Props extends object = {}, Statics extends object = {}>(
    this: Extend, parent: Parent, prototypeProperties?: Props & ThisType<InstanceFor<Parent, Props>>,
    staticProperties?: Statics & ThisType<Extension<Parent, Props, Statics>>
  ): Extension<Parent, Props, Statics>;
}

// Borrowed from backbone.js
function extendRuntime(
  this: Function & { prototype: object },
  protoProps?: object,
  staticProps?: object
) {
  const parent = this;
  let child;

  // The constructor function for the new subclass is either defined by you
  // (the "constructor" property in your `extend` definition), or defaulted
  // by us to simply call the parent constructor.
  if (protoProps && Object.hasOwn(protoProps, 'constructor')) {
    child = protoProps.constructor;
  } else {
    child = function(this: object) { return parent.apply(this, arguments); };
  }

  // Add static properties to the constructor function, if supplied.
  // Parent statics include inherited enumerable properties (Backbone's extend contract).
  // eslint-disable-next-line guard-for-in
  for (const key in parent) { setProperty(child, key, (parent as unknown as Record<string, unknown>)[key]); }
  Object.defineProperties(child, Object.getOwnPropertyDescriptors({ ...staticProps }));

  // Set the prototype chain to inherit from `parent`, without calling
  // `parent`'s constructor function and add the prototype properties.
  child.prototype = Object.create(parent.prototype, Object.getOwnPropertyDescriptors({
    ...protoProps,
    constructor: child
  }));

  // Set a convenience property in case the parent's prototype is needed
  // later.
  (child as Function & { __super__: object }).__super__ = parent.prototype;

  return child;
}

const extend = extendRuntime as Extend;
export default extend;
