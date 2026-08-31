# Marionette Utility Exports

Marionette exports the standalone utilities and package facts that do not require a
framework instance. Common framework conventions such as `bindEvents`, `getOption`,
`mergeOptions`, `normalizeMethods`, and `triggerMethod` are documented as
[instance methods](./common.md).

The v4 target-first exports also adapted these conventions to arbitrary plain
objects. That adapter is not part of v5. Extend `MnObject` when the object should
participate in Marionette conventions, or keep a genuinely standalone convention
local to the consumer instead of borrowing a Marionette prototype method.

## Documentation Index

* [extend](#extend)
* [VERSION](#version)

## extend

`extend` is Marionette's owned, standalone implementation of its classic
pseudo-class extension convention. Assign it to a constructor, then call it as
a method so that constructor is the parent. Marionette's extendable classes
already expose this method.

<!-- executable-example: utils-owned-extend -->
```javascript
import { extend } from 'marionette';

function Service(name) {
  this.name = name;
}

Service.extend = extend;

const SpecialService = Service.extend({
  label() {
    return `special:${this.name}`;
  }
}, {
  kind: 'special'
});

const service = new SpecialService('api');

export { Service, SpecialService, extend, service };
```

The child inherits the parent's prototype and static properties. Prototype
properties are supplied by the first argument and optional static properties
by the second. See the [v4 compatibility ledger](./migration-from-v4.md#compatibility-ledger)
for the v5 input-copying boundary.

## VERSION

`VERSION` is the installed Marionette package version. Marionette also uses it
when constructing versioned diagnostic documentation URLs; exporting it does
not imply that a corresponding website deployment is available.

<!-- executable-example: utils-version -->
```javascript
import { VERSION } from 'marionette';

export { VERSION };
```
