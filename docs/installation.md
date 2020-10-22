# Installing Marionette

As with all JavaScript libraries, there are a number of ways to get started with
a Marionette application. In this section we'll cover the most common ways.
While some integrations are listed here, more resources are available in the integrations repo:
[marionette-integrations](https://github.com/marionettejs/marionette-integrations)

## Documentation Index

* [NPM and Webpack](#quick-start-using-npm-and-webpack)
* [NPM and Brunch](#quick-start-using-npm-and-brunch)
* [NPM and Browserify](#quick-start-using-npm-and-browserify)
* [Browserify and Grunt](#browserify-and-grunt)
* [Browserify and Gulp](#browserify-and-gulp)
* [Getting Started](./basics.md)

## Quick start using NPM and Webpack
[NPM](https://www.npmjs.com/) is the package manager for JavaScript.

Installing with NPM through command-line interface
```
npm install backbone.marionette
```

[Webpack][webpack] is a build tool that makes it easy to pull your dependencies
together into a single bundle to be delivered to your browser's `<script>` tag.
It works particularly well with Marionette and jQuery.

[Here](https://github.com/marionettejs/marionette-integrations/tree/master/webpack)
we prepared simple marionettejs skeleton with Webpack.


## Quick start using NPM and Brunch

[Brunch][brunch] is fast front-end web app build tool with simple declarative config,
seamless incremental compilation for rapid development, an opinionated pipeline
and workflow, and core support for source maps.

[Here](https://github.com/marionettejs/marionette-integrations/tree/master/brunch)
we prepared simple marionettejs skeleton with Brunch.


## Quick start using NPM and Browserify

[Browserify][browserify] is a build tool that makes it easy to bundle NPM
modules into your application, so you can `require` them as you would import
dependencies in any other language.

[Here](https://github.com/marionettejs/marionette-integrations/tree/master/browserify)
we prepared simple marionettejs skeleton with Browserify.

### Browserify and Grunt

[Grunt][grunt] is task runner. [Here](https://github.com/marionettejs/marionette-integrations/tree/master/browserify-grunt) is simple Browserify + Grunt skeleton.

### Browserify and Gulp

[Gulp][gulp] is streaming build system. [Here](https://github.com/marionettejs/marionette-integrations/tree/master/browserify-gulp) is simple Browserify + Gulp skeleton.


[browserify]: http://browserify.org/
[webpack]: https://webpack.github.io/
[brunch]: http://brunch.io/
[grunt]: http://gruntjs.com/
[gulp]: http://gulpjs.com/

## Getting Started

After installing Marionette you might want to check out the basics.

[Continue Reading...](./basics.md).

Additionally check out [features](./features.md) for some configurable options.
