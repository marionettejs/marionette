<h1 align="center">Marionette.js</h1>
<p align="center">
  <img title="marionette" src='https://github.com/marionettejs/marionette/raw/master/marionette-logo.png' />
</p>
<p align="center">The Backbone Framework</p>
<p align="center">
  <a title='Build Status' href="https://travis-ci.org/marionettejs/backbone.marionette">
    <img src='https://secure.travis-ci.org/marionettejs/backbone.marionette.svg?branch=master' />
  </a>
  <a href='https://coveralls.io/r/marionettejs/backbone.marionette'>
    <img src='https://img.shields.io/coveralls/marionettejs/backbone.marionette.svg' alt='Coverage Status' />
  </a>
  <a href='https://gitter.im/marionettejs/backbone.marionette?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=body_badge'>
    <img src='https://badges.gitter.im/Join%20Chat.svg' alt='Gitter Chat' />
  </a>
</p>
<p align="center">
  <img src='https://saucelabs.com/browser-matrix/marionettejs.svg' alt='Cross Browser Testing' />
</p>

## Marionette v5

#TODO# Update documentation

## About Marionette

Marionette is a composite application library for Backbone.js that
aims to simplify the construction of large scale JavaScript applications.
It is a collection of common design and implementation patterns found in
applications.

## Documentation

All of the documentation for Marionette can be found at

##### [marionettejs.com/docs/current](http://marionettejs.com/docs/current)

### App Architecture On Backbone's Building Blocks

Backbone provides a great set of building blocks for our JavaScript
applications. It gives us the core constructs that are needed to build
small apps, organize jQuery DOM events, or create single page apps that
support mobile devices and large scale enterprise needs. But Backbone is
not a complete framework. It's a set of building blocks. It leaves
much of the application design, architecture and scalability to the
developer, including memory management, view management, and more.

Marionette brings an application architecture to Backbone, along with
built in view management and memory management. It's designed to be a
lightweight and flexible library of tools that sits on top of Backbone,
providing the framework for building a scalable application.

Like Backbone itself, you're not required to use all of Marionette just
because you want to use some of it. You can pick and choose which features
you want to use. This allows you to work with other Backbone
frameworks and plugins easily. It also means that you are not required
to engage in an all-or-nothing migration to begin using Marionette.

### Chat with us

Find us [on gitter](https://gitter.im/marionettejs/backbone.marionette).

We're happy to discuss design patterns and learn how you're using Marionette.


### Key Benefits

* Scalable: applications built in modules with event-driven architecture
* Sensible defaults: Underscore templates are used for view rendering
* Easily modifiable: works with the specific needs of your application
* Reduce boilerplate: for all views, including specialized types
* Create: application visuals at runtime with `Region` and `View` objects
* Nested: `View`s and `CollectionView`s within visual regions
* Built-in: memory management and zombie-killing for `View`s, `CollectionViews`a and `Region`s
* Event-driven architecture: utilizing `Radio`
* Flexible: "as-needed" architecture allowing you to pick and choose what you need
* And much, much more

## Source Code and Downloads

You can
[download the latest builds directly](https://github.com/marionettejs/marionette/tree/master/lib)
or visit the [downloads section on the Marionette website](http://marionettejs.com#download)
for more downloading options.

#### [MarionetteJS.com](http://marionettejs.com#download)

### NPM and Bower

Marionette is available via npm:

```bash
# NPM
npm install marionette
```

## Release Notes And Upgrade Guide

**Changelog**: For change logs and release notes, see the
[changelog](changelog.md) file.

**Upgrade Guide**: Be sure to read [the upgrade guide](upgradeGuide.md)
for information on upgrading to the latest version of Marionette.


### Annotated Source Code

The source code for Marionette is heavily documented.
You can read the annotations for all the details of how Marionette works and advice on which methods to override.

##### [View the annotated source code](http://marionettejs.com/annotated-src/marionette)

## Compatibility and Requirements

MarionetteJS currently works with the following libraries:

* [jQuery](http://jquery.com) v3.5.1+
* [Underscore](http://underscorejs.org) v1.11.0+

Marionette has not been tested against any other versions of these
libraries. You may or may not have success if you use a version other
than what is listed here.

## How to Contribute

If you would like to contribute to Marionette's source code, please read
the [guidelines for pull requests and contributions](CONTRIBUTING.md).
Following these guidelines will help make your contributions easier to
bring into the next release.

### [Github Issues](https://github.com/marionettejs/backbone.marionette/issues)

Report issues with Marionette, submit pull requests to fix problems, or to
create summarized and documented feature requests (preferably with pull
requests that implement the feature).
