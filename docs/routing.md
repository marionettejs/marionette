# Routing in Marionette

Users of versions of Marionette prior to v4 will notice that a router is no longer a [bundled class](./classes.md).
The [Marionette.AppRouter](https://github.com/marionettejs/marionette.approuter) was extracted
and the core library will no longer hold an opinion on routing.

## Some Routing Solutions

Besides the router [bundled with Backbone](http://backbonejs.org/#Router) there are many viable
routing solutions available.  Some specifically designed for Backbone or Marionette and some
that are generic solutions for any framework.  Here are a few of those options.

## Marionette Community Routers

### [Marionette.AppRouter](https://github.com/marionettejs/marionette.approuter)

Previously bundled router. Extends [backbone.router](http://backbonejs.org/#Router) and is helpful
for breaking a large amount of routes on a single backbone.router instance into smaller more managable
approuters.

### [Marionette.Routing](https://github.com/blikblum/marionette.routing)

An advanced router for MarionetteJS applications. Includes nested routes, states, rendering,
async operations, lazy loading routes, Radio channel eventing, and inherits most of CherryTree
features while maintaining a similar to Marionette API.

### [Backbone.Eventrouter](https://github.com/RoundingWellOS/backbone.eventrouter)

A highly opinionated, simplistic Backbone.Router coupled with a Backbone.Radio.Channel.
When an event is triggered on the channel, it will set the route URL, or when a URL matches
a route it will throw an event on the channel.

## Generic Routers

[Stateman](https://github.com/leeluolee/stateman)
Angular-UI style routing, without the Angular

[Cherrytree](https://github.com/QubitProducts/cherrytree)
Nested routes, like Ember, but without the transition lifecycle.

[router.js](https://github.com/tildeio/router.js)
This is what Ember's router is built on top of. It has all of the features needed for good routing

## Know of other routers that should be listed here?
[Add them!](https://github.com/marionettejs/backbone.marionette/edit/next/docs/routing.md)
