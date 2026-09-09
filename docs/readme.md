# Build your first piece of UI

A View handles a piece of the interface. A Region puts it on the page and cleans
it up when it is replaced. Start there; add the other pieces when you need them.

## Where do you want to start?

- **[Start a development project](development.md)** — use matching candidate packages, TypeScript, lint, tests, and Vite.
- **[Troubleshoot a problem](troubleshooting.md)** — follow a symptom or diagnostic code to a fix.
- **[Build something](installation.md#quick-start)** — set up Marionette and show your first View.
- **[Work with an agent](agents.md)** — give your agent the right contract and a concrete task.
- **[Look up an API](public-api.md)** — find the class, method, or integration you need.

## A button that does something

With a [matching v5 build](installation.md#install) installed, add a place for the
View in your HTML:

```html
<main id="app"></main>
```

Then run this module in your application:

<!-- executable-example: first-view-counter -->
```javascript
import { Region, View } from 'marionette';

const Counter = View.extend({
  initialize() { this.count = 0; },
  template: ({ count }) => `<button type="button">Count: <span>${count}</span></button>`,
  templateContext() { return { count: this.count }; },
  events: { 'click button': 'increment' },
  increment() {
    this.count += 1;
    this.el.querySelector('span').textContent = String(this.count);
  }
});

export const region = new Region({ el: '#app' });
region.show(new Counter());
```

Click the button: **Count: 0 → Count: 1 → Count: 2**. The View handles the click
and updates the number in place. The button stays the same DOM element.

When that part of the screen is finished, `region.empty()` destroys the View and
removes its event handlers. The `#app` mount remains, ready for the next View.

## Give it a little more to do

| You want to… | Next step |
| --- | --- |
| Show a list that changes | [Render children with CollectionView](marionette.collectionview.md) |
| Open a detail screen | [Show and replace a View](marionette.region.md) |
| Save a form without losing a draft | [Forms and accessibility](forms-and-accessibility.md) |
| Connect an existing router or data source | [Choose integrations](choosing-integrations.md) |
| Check that it works | [Test an application](testing.md) |

You can keep Backbone models, an existing router, or a preferred template system.
Choose each integration for the job it does; the button above needs none of them.

For versions before v5, see the [backbone.marionette repository](https://github.com/marionettejs/backbone.marionette).
