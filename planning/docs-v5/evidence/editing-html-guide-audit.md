# Local editing and existing HTML guide audit

Date: 2026-09-30

## Teaching scope

Two independent tasks supplement the class references. Local editing uses a View's own observable Model without introducing an Application. Existing HTML adopts a root without requiring a renderer or data package. Neither guide depends on the records example.

The data choice is explicitly optional and incomplete: native Models do not save or fetch. The editing example has immediate updates rather than a draft workflow; it changes the existing input and preview without replacing the View. The HTML example passes an actual element as View.el and documents that destruction removes adopted markup.

## Executable checks

`test/docs/editing-html-checks.mjs` reads each guide's actual HTML fence for its DOM preparation. The reference runner executes its JavaScript fence and then checks:

- local input changes update the model and text safely;
- the input node, focus, and selection survive typing;
- external model changes update the same controls;
- emptying the Region destroys its editor but leaves the borrowed Model alive;
- removed editors no longer receive model or DOM events;
- existing HTML retains its root and controls through construction and render();
- visibility and aria-expanded change together;
- attached markup starts rendered and attached without construction lifecycle notifications;
- destruction removes the adopted root and ends DOM handlers.

Both guides passed focused execution using current built public package entrypoints and JSDOM. Scoped ESLint passed for the checks module. Initial execution caught a selector passed to View.el; the final guide uses document.querySelector, consistent with the current constructor contract. Normal installed-package execution is integrated separately by the root task.

These checks establish the documented behavior in JSDOM. They do not establish browser-wide accessibility, production integration quality, or teaching effectiveness. The examples deliberately avoid workflow scaffolding, persistence helpers, and benchmark-specific requirements.

## Review correction

Claude identified a conflict between manual preview text updates and Lit's interpolation
markers. The added forced-render check failed on the original example. The guide now
uses model-triggered Lit rendering and the live directive for input values; the
forced-render assertion stays in installed and browser checks. This preserves the
View-local responsibility while removing manual DOM synchronization.
