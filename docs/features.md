# Feature flags

Marionette feature flags are stored in one module-global registry for each loaded
copy of Marionette. Every application and Marionette class using that copy sees
the same values. Configure built-in flags once during application bootstrap,
before constructing any views.

## Documentation index

* [Checking a feature flag](#checking-a-feature-flag)
* [Setting feature flags at bootstrap](#setting-feature-flags-at-bootstrap)
* [Custom feature names](#custom-feature-names)
* [Current features](#current-features)

## Checking a feature flag

`isEnabled(name)` always returns a boolean. It returns the truthiness of the
stored state for a known string name, and `false` for unknown, blank, or
non-string names. It does not throw for invalid input.

```javascript
import { isEnabled } from 'marionette';

isEnabled('triggersPreventDefault'); // true
isEnabled('missingFeature'); // false
isEnabled(null); // false
```

## Setting feature flags at bootstrap

`setEnabled(name, state)` stores and returns the exact `state` value. Marionette
uses that value by truthiness when checking the flag; the state is not otherwise
validated or coerced. A non-string or blank name throws `MarionetteError` code
[`MN0027`](/errors/MN0027/) before changing the registry.

Set built-in flags before constructing `View` or `CollectionView` instances.
Their child-event prefix and delegated trigger callbacks capture the applicable
flag state during setup. Changing a flag later does not itself rebuild existing
event proxies or delegated callbacks; an explicit `delegateEvents()` refresh,
including one caused by `setElement()`, resolves the then-current flag values.

<!-- executable-example: feature-flags-bootstrap -->
```javascript
import { isEnabled, setEnabled } from 'marionette';

setEnabled('childViewEventPrefix', true);
setEnabled('triggersPreventDefault', false);
setEnabled('triggersStopPropagation', false);

export const featureStates = {
  childViewEventPrefix: isEnabled('childViewEventPrefix'),
  triggersPreventDefault: isEnabled('triggersPreventDefault'),
  triggersStopPropagation: isEnabled('triggersStopPropagation')
};
```

The registry has no application ownership, lifecycle hooks, scoped overrides,
reset operation, or automatic cleanup. A value remains in the loaded module's
registry until another `setEnabled` call overwrites it or the process ends.

## Custom feature names

For compatibility with v3 and v4, `setEnabled` accepts any non-empty string and
therefore can store application-owned flags. Marionette does not read custom
names, namespace them, or clean them up. Prefer an explicit application
configuration object or service for new application flags so their ownership
and lifecycle are clear and they cannot collide with a future Marionette name.

`DEV_MODE` is not a built-in v5 feature. Calling `setEnabled('DEV_MODE', true)`
stores a custom truthy value but has no effect on Marionette diagnostics or
runtime behavior. Remove that v4 deprecation-warning configuration.

## Current features

These are the only built-in flags in v5:

| Name | Default | Effect |
| --- | --- | --- |
| `childViewEventPrefix` | `false` | When truthy, the default [`childViewEventPrefix`](./events.md#a-child-views-event-prefix) is `childview`, producing events such as `childview:render`. When falsey, automatic child-event bubbling is disabled unless the View supplies its own prefix. |
| `triggersPreventDefault` | `true` | When truthy, [`View.triggers`](./dom.interactions.md#view-triggers) calls `event.preventDefault()` unless that trigger explicitly sets `preventDefault: false`. When falsey, a trigger must explicitly set `preventDefault: true` to call it. |
| `triggersStopPropagation` | `true` | When truthy, [`View.triggers`](./dom.interactions.md#view-triggers) calls `event.stopPropagation()` unless that trigger explicitly sets `stopPropagation: false`. When falsey, a trigger must explicitly set `stopPropagation: true` to call it. |
