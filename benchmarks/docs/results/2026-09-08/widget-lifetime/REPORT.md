# Widget lifetime trial

Implemented `createWidgetView(mountWidget)` in `solution.mjs` using the installed Marionette `View`, native DOM querying, and the default function-template renderer. No dependencies or global runtime configuration were changed.

## Documentation consulted

- `.agents/skills/marionette/SKILL.md` and its `scripts/docs.mjs` helper.
- Installed `node_modules/marionette/dist/docs/docs/agents.md`.
- Installed `docs/view.lifecycle.md`: rendered descendants versus the fixed root, managed attachment, render transitions, detach/re-show, and destruction.
- Installed `docs/events.class.md`: `dom:refresh` and `dom:remove` contracts.
- Relevant sections of installed `docs/marionette.view.md` and `docs/marionette.region.md`: construction, function templates, showing, emptying, and detaching Views.
- Application and installed package manifests, plus installed ESM export/View declarations.

The helper verified the documentation manifest and reported Marionette `5.0.0-alpha.2`, source revision `5bb66c7f1559ae3902db06847a378e9e5c3907a7`, `sourceDirty: true`, and content hash `36a974040fa13f483e68a213029e313c96339dd16384343a39e40964ac373f00`. This is a custom local artifact, not an immutable release claim. The application has no root lockfile or test scripts.

## Lifetime decisions

The View owns the active widget, retained in a factory-local variable. The caller owns its Region. `onDomRefresh` mounts the widget on `.widget-host` after content becomes available in the document. `onDomRemove` clears the reference and destroys the old instance before content replacement or detachment. This single hook pair handles initial attachment, attached rerender, detach, reattachment without rerender, and attached destruction. Rendering while detached does not mount a widget. Clearing the reference before calling external cleanup prevents double cleanup if it reenters that callback.

The lifecycle page links directly to the event contracts and was sufficient to select these hooks. The Region page's note says a detached View must be passed to a "new region" or manually destroyed; the lifecycle table and the installed-runtime check demonstrate that showing it again in the same emptied Region also works. That wording could be more precise.

## Commands actually run

All work ran within this task directory. Read-only inspection used `pwd`, `git status --short`, `cat`, `rg`, `sed`, `head`, and `ls -a`. The initial chained inspection stopped at `git status` because this trial is not a Git repository; subsequent reads ran separately. Some initial broad documentation search output was truncated, so the relevant event and Region sections were reread with narrow line selections.

Documentation helper commands:

```sh
/Users/paulfalgout/.nvm/versions/node/v24.19.0/bin/node .agents/skills/marionette/scripts/docs.mjs --project /tmp/marionette-docs-trial-20260908-a/widget-lifetime --list
/Users/paulfalgout/.nvm/versions/node/v24.19.0/bin/node .agents/skills/marionette/scripts/docs.mjs --project /tmp/marionette-docs-trial-20260908-a/widget-lifetime --page docs/agents.md
```

Validation commands, both passed:

```sh
/Users/paulfalgout/.nvm/versions/node/v24.19.0/bin/node validate.mjs
/Users/paulfalgout/.nvm/versions/node/v24.19.0/bin/node --check solution.mjs
```

`validate.mjs` is an independently written installed-runtime check using the already installed jsdom. It exercises detached repeated renders, initial show, repeated show, attached rerender, detach, repeated detach, re-show of the same instance in the same Region, attached destroy, repeated destroy, render after destroy, and destruction before any attachment. Every mount asserts the host is connected. Every cleanup asserts the host is still connected, its widget content is present, and the instance has been destroyed exactly once. The rerender also verifies a new host; re-show verifies preservation of the existing host.

## Limitations

Validation used jsdom, not a real browser. It establishes lifecycle order and document membership in that runtime but does not prove browser layout, focus, paint, or a concrete third-party widget's behavior. No acceptance tests, library checkout, sibling trials, network, or dependency installation were used. Widget callbacks are synchronous and assumed to fulfill the supplied contract; arbitrary external DOM removal, disabled attachment monitoring, and throwing widget callbacks are outside the requested managed lifetime.
