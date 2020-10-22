# Features

Marionette Features are opt-in functionality that you can enable by utilizing [`setEnabled`](#setting-a-feature-flag) in your app.
It is a good practice to set these flags only once prior to instantiating any Marionette class.

## Documentation Index

* [Goals](#goals)
* [Checking a Feature Flag state](#checking-a-feature-flag-state)
* [Setting a Feature Flag](#setting-a-feature-flag)
* [Current Features](#current-features)

## Goals:
+ make it possible to add breaking changes in a minor release
+ give community members a chance to provide feedback for new functionality

## Checking a Feature Flag State

Use `isEnabled` if you need to know the state of a feature flag programmatically.

```javascript
import { isEnabled } from 'backbone.marionette';

isEnabled('fooFlag'); // false
```

## Setting a Feature Flag

Use `setEnabled` to change the value of a flag.
While setting a flag at any point may work, these flags are designed to be set before
any functionality of Marionette is used. Change flags after at your own risk.

```javascript
import { setEnabled } from 'backbone.marionette';

setEnabled('fooFlag', true);

const myApp = new MyApp({
  region: '#app-hook'
});

myApp.start();
```

## Current Features

### `childViewEventPrefix`

*Default:* `false`

This flag indicates whether [`childViewEventPrefix`](./events.md#a-child-views-event-prefix)
for all views will return the default value of `'childview'` or if it will return `false`
disabling [automatic event bubbling](./events.md#event-bubbling).

### `triggersPreventDefault`

*Default:* `true`

It indicates the whether or not [`View.triggers` will call `event.preventDefault()`](./dom.interactions.md#view-triggers-event-object) if not explicitly defined by the trigger.
The default has been true, but for a future version [`false` is being considered](https://github.com/marionettejs/backbone.marionette/issues/2926).

### `triggersStopPropagating`

*Default:* `true`

It indicates the whether or not [`View.triggers` will call `event.stopPropagating()`](./dom.interactions.md#view-triggers-event-object) if not explicitly defined by the trigger.
The default has been true, but for a future version [`false` is being considered](https://github.com/marionettejs/backbone.marionette/issues/2926).

### DEV_MODE

*Default:* `false`

If `true`, deprecation console warnings are issued at runtime.
