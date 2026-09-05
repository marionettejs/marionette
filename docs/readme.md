# Marionette v5 documentation

Start with the part of the interface you want to build. The same classes work
together as the application grows; you do not need to learn every integration
before showing your first View.

These repository guides describe the current v5 source. Published alphas may lag
behind it.

## Build something

- [Install Marionette](installation.md) and show a first View.
- [Choose a class for the job](https://github.com/marionettejs/marionette/blob/master/docs/classes.md).
- [Build a screen with a View](https://github.com/marionettejs/marionette/blob/master/docs/marionette.view.md).
- [Show and replace a View in a Region](https://github.com/marionettejs/marionette/blob/master/docs/marionette.region.md).
- [Render a list with CollectionView](https://github.com/marionettejs/marionette/blob/master/docs/marionette.collectionview.md).
- [Share interactions with Behaviors](https://github.com/marionettejs/marionette/blob/master/docs/marionette.behavior.md).
- [Start and stop a feature with Application](https://github.com/marionettejs/marionette/blob/master/docs/marionette.application.md).

## Connect the parts

- [Configuration and inheritance](https://github.com/marionettejs/marionette/blob/master/docs/basics.md)
- [Templates and rendering](https://github.com/marionettejs/marionette/blob/master/docs/view.rendering.md)
- [DOM interactions](https://github.com/marionettejs/marionette/blob/master/docs/dom.interactions.md)
- [Lifecycle and cleanup](https://github.com/marionettejs/marionette/blob/master/docs/view.lifecycle.md)
- [Events](https://github.com/marionettejs/marionette/blob/master/docs/events.md) and [Radio channels](https://github.com/marionettejs/marionette/blob/master/docs/radio.md)
- [State sources and observation](marionette.state.md)
- [Data and observable collections](data.api.md)
- [Routing](https://github.com/marionettejs/marionette/blob/master/docs/routing.md)

## Choose your integrations

- [Optional Backbone integration](optional-backbone.md)
- [The DOM API](https://github.com/marionettejs/marionette/blob/master/docs/dom.api.md)
- [Pre-rendered DOM](dom.prerendered.md)
- [Runtime isolation](runtime-isolation.md)

## Look up the details

Some references open in GitHub while the v5 documentation site is being completed.

- [Common class methods](https://github.com/marionettejs/marionette/blob/master/docs/common.md) and [utility exports](https://github.com/marionettejs/marionette/blob/master/docs/utils.md)
- [Class events](https://github.com/marionettejs/marionette/blob/master/docs/events.class.md) and [model and collection events](https://github.com/marionettejs/marionette/blob/master/docs/events.entity.md)
- [MnObject](https://github.com/marionettejs/marionette/blob/master/docs/marionette.mnobject.md)
- [Terminology](terminology.md)
- [Diagnostics](diagnostic-catalog.md)
- [v4-to-v5 compatibility ledger](migration-from-v4.md)
- [Upgrade guide](../upgradeGuide.md)
- [Contributing](https://github.com/marionettejs/marionette/blob/master/CONTRIBUTING.md), [performance baselines](performance-baselines.md),
  and the [release profile](https://github.com/marionettejs/marionette/blob/master/docs/release-profile.md)

The API reference is being reconciled for stable v5 in
[issue #147](https://github.com/marionettejs/marionette/issues/147). Until that
work is complete, do not treat the hosted `/docs/current` site as v5
documentation; it describes earlier releases.
