# View Template Rendering

Unlike [`Backbone.View`](http://backbonejs.org/#View-template), [Marionette views](./classes.md)
provide a customizable solution for rendering a template with data and placing the
results in the DOM.

```javascript
import _ from 'underscore';
import { View } from 'backbone.marionette';

const MyView = View.extend({
  tagName: 'h1',
  template: _.template('Contents')
});

const myView = new MyView();
myView.render();
```

In the above example the contents of the `template` attribute will be rendered inside
a `<h1>` tag available at `myView.el`.

[Live example](https://jsfiddle.net/marionettejs/h762zjua/)

## Documentation Index

* [What is a template](#what-is-a-template)
* [Setting a View Template](#setting-a-view-template)
  * [Using a View Without a Template](#using-a-view-without-a-template)
* [Rendering the Template](#rendering-the-template)
  * [Using a Custom Renderer](#using-a-custom-renderer)
  * [Rendering to HTML](#rendering-to-html)
  * [Rendering to DOM](#rendering-to-dom)
* [Serializing Data](#serializing-data)
  * [Serializing a Model](#serializing-a-model)
  * [Serializing a Collection](#serializing-a-collection)
  * [Serializing with a `CollectionView`](#serializing-with-a-collectionview)
* [Adding Context Data](#adding-context-data)
  * [What is Context Data?](#what-is-context-data)

## What is a template?

A template is a function that given data returns either an HTML string or DOM.
[The default renderer](#rendering-the-template) in Marionette expects the template to
return an HTML string. Marionette's dependency Underscore comes with an HTML string
[template compiler](http://underscorejs.org/#template).

```javascript
import _ from 'underscore';
import { View } from 'backbone.marionette';

const MyView = View.extend({
  template: _.template('<h1>Hello, world</h1>')
});
```
This doesn't have to be an underscore template, you can pass your own rendering
function:

```javascript
import Handlebars from 'handlebars';
import { View } from 'backbone.marionette';

const MyView = View.extend({
  template: Handlebars.compile('<h1>Hello, {{ name }}')
});
```

[Live example](https://jsfiddle.net/marionettejs/ep0e4qkt/)

## Setting a View Template

Marionette views use the `getTemplate` method to determine which template to use for
rendering into its `el`. By default `getTemplate` is predefined on the view as simply:

```javascript
getTemplate() {
  return this.template
}
```

In most cases by using the default `getTemplate` you can simply set the `template` on the
view to define the view's template, but in some circumstances you may want to set the template
conditionally.

```javascript
import { View } from 'backbone.marionette';

const MyView = View.extend({
  template: _.template('Hello World!'),
  getTemplate() {
    if (this.model.has('user')) {
      return _.template('Hello User!');
    }

    return this.template;
  }
});
```

[Live example](https://jsfiddle.net/marionettejs/9k5v4p92/)

### Using a View Without a Template

By default `CollectionView` has no defined `template` and will only attempt to render the `template`
if one is defined. For `View` there may be some situations where you do not intend to use a `template`.
Perhaps you only need the view's `el` or you are using [prerendered content](./dom.prerendered.md).

In this case setting `template` to `false` will prevent the template render. In the case of `View`
it will also prevent the [`render` events](./events.class.md#render-and-beforerender-events).

```javascript
import { View } from 'backbone.marionette';

const MyIconButtonView = View.extend({
  template: false,
  tagName: 'button',
  className: '.icon-button',
  triggers: {
    'click': 'click'
  },
  onRender() {
    console.log('You will never see me!');
  }
});
```

## Rendering the Template

Each view class has a renderer which by default passes the [view data](#serializing-data)
to the template function and returns the html string it generates.

The current default renderer is essentially the following:
```javascript
import { View, CollectionView } from 'backbone.marionette';

function renderer(template, data) {
  return template(data);
}

View.setRenderer(renderer);
CollectionView.setRenderer(renderer);
```

Previous to Marionette v4 the default renderer was the `TemplateCache`. This renderer has been extracted
to a separate library: https://github.com/marionettejs/marionette.templatecache and can be used with v4.

### Using a Custom Renderer

You can set the renderer for a view class by using the class method `setRenderer`.
The renderer accepts two arguments. The first is the template passed to the view,
and the second argument is the data to be rendered into the template.

Here's an example that allows for the `template` of a view to be an underscore template string.

```javascript
import _ from 'underscore';
import { View } from 'backbone.marionette';

View.setRenderer(function(template, data) {
  return _.template(template)(data);
});

const myView = new View({
  template: 'Hello <%- name %>!',
  model: new Backbone.Model({ name: 'World' })
});

myView.render();

// myView.el is <div>Hello World!</div>
```

The renderer can also be customized separately on any extended View.

```javascript
const MyHBSView = View.extend();

// Similar example as above but for handlebars
MyHBSView.setRenderer(function(template, data) {
  return Handlebars.compile(template)(data);
});

const myHBSView = new MyHBSView({
  template: 'Hello {{ name }}!',
  model: new Backbone.Model({ name: 'World' })
});

myHBSView.render();

// myView.el is <div>Hello World!</div>
```

**Note** These examples while functional may not be ideal. If possible it is recommend to
precompile your templates which can be done for a number of templating using various plugins
for bundling tools such as [Browserify or Webpack](./installation.md).

### Rendering to HTML

The default Marionette renders return the HTML as a string. This string is passed to the view's
`attachElContents` method which in turn uses the DOM API's [`setContents`](./dom.api.md#setcontentsel-html).
to set the contents of the view's `el` with DOM from the string.

#### Customizing `attachElContents`

You can modify the way any particular view attaches a compiled template to the `el` by overriding `attachElContents`.
This method receives only the results of the view's renderer and is only called if the renderer returned a value.

For instance, perhaps for one particular view you need to bypass the [DOM API](./dom.api.md) and set the html directly:

```javascript
attachElContent(html) {
  this.el.innerHTML = html;
}
```

### Rendering to DOM

Marionette also supports templates that render to DOM instead of html strings by using a custom render.

In the following example the `template` method passed to the renderer will return a DOM element, and then
if the view is already rendered utilize [morphdom](https://github.com/patrick-steele-idem/morphdom) to patch
the DOM or otherwise it will set the view's `el` to the result of the template. (Note in this case the view's
`el` created at instantiation would be overridden).

```javascript
import morphdom from 'morphdom';
import { View } from 'backbone.marionette';

const VDomView = View.extend();

VDomView.setRenderer(function(template, data) {
  const el = template(data);

  if (this.isRendered()) {
    // Patch the view's el contents in the DOM
    morphdom(this.el, el, { childrenOnly: true });
    return;
  }

  this.setElement(el.cloneNode(true));
});
```

In this case because the renderer is modifying the `el` directly, there is no need to return the result
of the template rendering for the view to handle in [`attachElContents`](#customizing-attachelcontents).
It is certainly an option to return the compiled DOM and modify [`attachElContents`](#customizing-attachelcontents)
to handle a DOM object instead of a string literal, but in many cases it may be overcomplicated to do so.

There are a variety of possibilities for rendering with Marionette. If you are looking into alternatives
from the default this may be a useful resource: https://github.com/blikblum/marionette.renderers#renderers

## Serializing Data

Marionette will automatically serialize the data from its `model` or `collection` for the template to use
at [rendering](#rendering-the-template). You can override this logic and provide serialization of other
data with the `serializeData` method. The method is called with no arguments, but has the context of the
view and should return a javascript object for the template to consume. If `serializeData` does not return
data the template may still receive [added context](#adding-context-data) or an empty object for rendering.

```javascript
import _ from 'underscore';
import { View } from 'backbone.marionette';

const MyView = View.extend({
  template: _.template(`
    <div><% user.name %></div>
    <ul>
    <% _.each(groups, function(group) { %>
      <li><%- group.name %></li>
    <% }) %>
    </ul>
  `),
  serializeData() {
    // For this view I need both the
    // model and collection serialized
    return {
      user: this.serializeModel(),
      groups: this.serializeCollection(),
    };
  }
});
```

**Note** You should not use this method to add arbitrary extra data to your template.
Instead use `templateContext` to [add context data to your template](#adding-context-data).

### Serializing a Model

If the view has a `model` it will pass that model's attributes
to the template.

```javascript
import _ from 'underscore';
import Backbone from 'backbone';
import { View } from 'backbone.marionette';

const MyModel = Backbone.Model.extend({
  defaults: {
    name: 'world'
  }
});

const MyView = View.extend({
  template: _.template('<h1>Hello, <%- name %></h1>')
});

const myView = new MyView({ model: new MyModel() });
```

[Live example](https://jsfiddle.net/marionettejs/warfa6rL/)

How the `model` is serialized can also be customized per view.

```javascript
import _ from 'underscore';
import { View } from 'backbone.marionette';

const MyView = View.extend({
  serializeModel() {
    const data = _.clone(this.model.attributes);

    // serialize nested model data
    data.sub_model = data.sub_model.attributes;

    return data;
  }
});
```

### Serializing a Collection

If the view does not have a `model` but has a `collection` the collection's models will
be serialized to an array provided as an `items` attribute to the template.

```javascript
import _ from 'underscore';
import Backbone from 'backbone';
import { View } from 'backbone.marionette';

const MyView = View.extend({
  template: _.template(`
    <ul>
    <% _.each(items, function(item) { %>
      <li><%- item.name %></li>
    <% }) %>
    </ul>
  `)
});

const collection = new Backbone.Collection([
  {name: 'Steve'}, {name: 'Helen'}
]);

const myView = new MyView({ collection });
```

[Live example](https://jsfiddle.net/marionettejs/qyodkakf/)

How the `collection` is serialized can also be customized per view.

```javascript
import _ from 'underscore';
import { View } from 'backbone.marionette';

const MyView = View.extend({
  serializeCollection() {
    return _.map(this.collection.models, model => {
      const data = _.clone(model.attributes);

      // serialize nested model data
      data.sub_model = data.sub_model.attributes;

      return data;
    });
  }
});
```

### Serializing with a `CollectionView`

if you are using a `template` with a `CollectionView` that is not also given a `model`, your `CollectionView`
will [serialize the collection](serializing-a-collection) for the template. This could be costly and unnecessary.
If your `CollectionView` has a `template` it is advised to either use an empty `model` or override the
[`serializeData`](#serializing-data) method.

## Adding Context Data

Marionette views provide a `templateContext` attribute that is used to add
extra information to your templates. This can be either an object, or a function
returning an object. The keys on the returned object will be mixed into the
model or collection keys and made available to the template.

```javascript
import _ from 'underscore';
import { View } from 'backbone.marionette';

const MyView = View.extend({
  template: _.template('<h1>Hello, <%- name %></h1>'),
  templateContext: {
    name: 'World'
  }
});
```

Additionally context data overwrites the serialized data

```javascript
import _ from 'underscore';
import { View } from 'backbone.marionette';

const MyView = View.extend({
  template: _.template('<h1>Hello, <%- name %></h1>'),
  templateContext() {
    return {
      name: this.model.get('name').toUpperCase()
    };
  }
});
```

You can also define a template context value as a method. How this method is called is determined
by your templating solution. For instance with handlebars a method is called with the context of
the data passed to the template.

```javascript
import Handlebars from 'handlebars';
import Backbone from 'backbone';
import { View } from 'backbone.marionette';

const MyView = View.extend({
  template: Handlebars.compile(`
    <h1{{#if isDr}} class="dr"{{/if}}>Hello {{ fullName }}</h1>,
  `),
  templateContext: {
    isDr() {
      return (this.degree) === 'phd';
    },
    fullName() {
      // Because of Handlebars `this` here is the data object
      // passed to the template which is the result of the
      // templateContext mixed with the serialized data of the view
      return this.isDr() ? `Dr. { this.name }` : this.name;
    }
  }
});

const myView = new MyView({
  model: new Backbone.Model({ degree: 'masters', name: 'Joe' });
});
```

**Note** the data object passed to the template is not deeply cloned and in some cases is not cloned at all.
Take caution when modifying the data passed to the template, that you are not also modifying your model's
data indirectly.

### What is Context Data?

While [serializing data](#serializing-data) deals more with getting the data belonging to the view
into the template, template context mixes in other needed data, or in some cases, might do extra
computations that go beyond simply "serializing" the view's `model` or `collection`

```javascript
import _ from 'underscore'
import { CollectionView } from 'backbone.marionette';
import GroupView from './group-view';

const MyCollectionView = CollectionView.extend({
  tagName: 'div',
  childViewContainer: 'ul',
  childView: GroupView,
  template: _.template(`
    <h1>Hello <% name %> of <% orgName %></h1>
    <div>You have <% stats.public %> group(s).</div>
    <div>You have <% stats.private %> group(s).</div>
    <h3>Groups:</h3>
    <ul></ul>
  `),
  templateContext() {
    const user = this.model;
    const organization = user.getOrganization();
    const groups = this.collection;

    return {
      orgName: organization.get('name'),
      name: user.getFullName(),
      stats: groups.countBy('type')
    };
  }
})
```
