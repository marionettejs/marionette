# Give a third-party widget a clear lifetime

Use the installed Marionette skill and documentation to implement `solution.mjs`.
An external widget is a function `mountWidget(element)` returning an object with
`destroy()`. It requires its element to be attached to the document when mounted.
It must be destroyed before that element is removed or its content is replaced.

Export `createWidgetView(mountWidget)`, returning a Marionette View instance with
a `.widget-host` element in its template. The caller owns a Marionette Region and
will show, rerender, detach, show again, and destroy the View.

Each active widget instance is destroyed exactly once. Rendering before attachment
must not mount it. Rerendering while attached must destroy the old instance before
replacing its host and mount the replacement. Detaching must clean up; showing the
same View again must mount one new instance. The caller uses Marionette's default
attachment monitoring. Do not change global configuration or patch internal fields.

In `REPORT.md`, record the docs consulted, lifetime decisions, commands actually
run, and limitations. Do not read acceptance tests or modify installed dependencies.
