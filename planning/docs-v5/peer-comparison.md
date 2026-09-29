# Peer documentation comparison

Scope: documentation structure and reader needs across Marionette, with the earlier lesson comparison retained below. These are inspections of official documentation, not a framework ranking or a measurement of agent outcomes. Peer examples were not installed or executed.

## Framework-wide decisions

Sources inspected 2026-09-29. [Diátaxis](https://diataxis.fr/) distinguishes learning, tasks, reference, and explanation. [Google's document guidance](https://developers.google.com/tech-writing/one/documents) starts from scope, audience, and what readers need to accomplish. These support the map in the [plan](plan.md); neither framework certifies our implementation's quality.

| Reader problem | Peer mechanisms | Marionette choice and tradeoff | Evidence that would change the choice |
| --- | --- | --- | --- |
| Learn without making a tutorial prerequisite for every lookup | [React's reference](https://react.dev/reference/react) points beginners to Learn while organizing APIs by function. [Svelte's overview](https://svelte.dev/docs/svelte/overview) distinguishes the tutorial from reference organized by language/runtime capabilities. | Keep learning material and reference independently navigable. Map the reference to Marionette classes and shared contracts. This adds navigation but removes the need to understand one sample application. | Independent lookup failures showing that the split hides context or required contracts. Improve the responsible links/content before adding tooling. |
| Find one precise contract | React links from its reference overview to feature/API sections; Svelte links to syntax, lifecycle, runtime and package reference sections in its [docs](https://svelte.dev/docs/svelte/overview). | A short API index, class pages and stable contract headings. Shared events/state/utilities have one authoritative location with links from applicable classes. Cross-page lookup is a cost to measure. | Repeated inability to find or combine the required answers, or duplicated contracts drifting. Test representative lookup paths before claiming findability. |
| Keep coverage independent of one example | React's [reference overview](https://react.dev/reference/react) maps its functional API areas; Svelte's [reference navigation](https://svelte.dev/docs/svelte/overview) spans capabilities beyond its introductory example. | Audit public classes, options, members, hooks/events, types and integrations; choose guides from reader needs. More reference coverage increases maintenance work. | A member audit reveals unsupported/internal material presented as public, or reader evidence shows a missing task area. Revise the map and its scope explicitly. |

These observations justify an initial structure to test, not a claim that a class page is universally superior. Review each structural milestone against the whole coverage inventory. Compare the reader operation and prerequisites; do not credit Svelte compiler-specific analysis to prose or assume Marionette needs equivalent infrastructure.

## CollectionView reference check

Sources inspected 2026-09-29. [React's list rendering guide](https://react.dev/learn/rendering-lists#keeping-list-items-in-order-with-key) explains identity alongside insertion, deletion and ordering. [Vue's list rendering guide](https://vuejs.org/guide/essentials/list.html#maintaining-state-with-key) connects keys to retained component/DOM state and separates source changes from filtered/sorted display.

The CollectionView reference therefore places child lifetime, source updates and display operations near its first example. It explicitly distinguishes filtering (retain child), reset/full render (rebuild), and same-key object replacement (replace child). These are Marionette contracts; peer key semantics do not establish them. A small runnable collection replaces further expansion of the records feature. Full API details remain available in method tables.

Tradeoff: the reference is longer than a list tutorial because it covers ownership operations and inherited contracts. Shared behavior is linked once. Reader lookup/extension results, or repeated confusion about the presentation-only `children` set, would justify a separate short task guide. This is a structural comparison, not measured parity with either framework.

## Application reference check

Sources inspected 2026-09-29. [React's effects guide](https://react.dev/learn/synchronizing-with-effects#fetching-data) pairs requests with cancellation or ignoring obsolete results. [Vue's watcher cleanup](https://vuejs.org/guide/essentials/watchers.html#side-effect-cleanup) places invalidation next to asynchronous effects. Both support explaining what happens when work outlives the UI requesting it.

Application's reference puts awaited readiness, cancellation and failure outcomes together, and distinguishes restart teardown from retained refresh. The example gives the Application a concrete asynchronous job and leaves rendering to its View. Marionette's prepare* gates, child ownership, signal scope and synchronous notification hooks come from its own implementation; component-effect behavior is not copied across frameworks.

Tradeoff: this reference explains lifecycle overlaps more fully than a getting-started lesson. The simple path comes first and tables cover lookups. Independent reader tasks must still test whether users choose prepareStart, restart or retained refresh correctly; a passing request stub cannot measure that. No peer runtime or agent comparison was executed in this slice.

## Behavior and MnObject reference check

Sources inspected 2026-09-29. [Vue's custom-directive guide](https://vuejs.org/guide/reusability/custom-directives.html) explains when reusable DOM work warrants a directive before listing hooks. [React's custom-Hook guide](https://react.dev/learn/reusing-logic-with-custom-hooks#when-to-use-custom-hooks) cautions against extracting every small repetition and distinguishes reusable logic from shared state.

The new class pages begin with the reason to choose the class and a small independent example. Behavior handles local Escape intent on a host; MnObject tracks draft changes through a borrowed source and owned state. Both describe where their responsibility ends. The host lifecycle and separate state source rules come from Marionette's implementation; these constructs are not claimed to be equivalents of directives or Hooks.

Tradeoff: a reference must document direct Behavior cleanup even though host declarations are the ordinary path. Shared contracts stay linked to avoid duplicating state, events and Radio semantics. The examples and peer comparison do not establish whether a reader will choose the right abstraction. A later lookup/extension task should check whether the reader keeps a one-off interaction in its View and explicitly disposes a nonvisual collaborator. Peer runtimes and fresh-reader outcomes were not compared here.

## Runtime and provider reference check

Sources inspected 2026-09-29. [Vue's Application API](https://vuejs.org/api/application.html) organizes app creation/configuration separately from its [Custom Renderer API](https://vuejs.org/api/custom-renderer.html), which lists the host operations and their types. [React's createRoot reference](https://react.dev/reference/react-dom/client/createRoot) places lifecycle methods, returns and cleanup beside usage examples, including partial-page integration.

The Marionette slice separates the reader's setup decision from provider implementation details: runtime scope/defaults first, rendering/DOM operations and data/state contracts on dedicated linked pages. A scope table makes affected classes and setter return values explicit. Provider method tables and the collection notification format support independent lookup. Existing setup remains a small recipe rather than a full provider tutorial.

These are documentation structure comparisons. A Marionette runtime configures classes and Radio; it is not a React root or Vue application. Marionette still requires DOM Elements/Nodes, so Vue's non-DOM renderer scope is not implied. Lifecycle/identity/disposal claims come from Marionette source and consumer checks. Peer runtimes were not executed, and no agent-effectiveness ranking is claimed.

Tradeoff: three focused reference pages add navigation, while keeping uncommon provider details out of ordinary setup. A reader trial should test choosing singleton versus isolated configuration, keeping a renderer/output pair coherent, and preserving a borrowed source through consumer teardown. Repeated lookup failures would justify navigation or explanation changes before adding integration helpers.

## Independent concepts and discovery check

Sources inspected 2026-09-29. [React's Managing State](https://react.dev/learn/managing-state) organizes state structure, sharing, and preservation as reader questions, with links to focused explanations. [Vue's Component Basics](https://vuejs.org/guide/essentials/component-basics.html) introduces component composition, data inputs, and child events in its main guide.

The Marionette concepts page now explains responsibilities and lifetime choices before directing readers to the records lesson. A small responsibility table links the six class references; state, event, and lifecycle details stay in their authoritative references. The index and quick start lead to concepts before the composed lesson. This follows the peers' explanatory structure while retaining Marionette's distinct Application/View/Region model.

Tradeoff: a prose concepts page introduces an extra reading step. It avoids making the full lesson a prerequisite but still needs a reader trial to establish whether its links and explanations help. The next comparison must preserve natural navigation in the guided package; removing those links would test a different product. Discovery traces, architecture review and build/extension behavior remain separate measurements. This structural comparison does not rank agent effectiveness or framework quality.

## Ownership decision reassessment

Sources rechecked 2026-09-29. [React's shared-state guide](https://react.dev/learn/sharing-state-between-components) starts with independent local state and moves ownership when a concrete coordination need appears. [Vue's state-management guide](https://vuejs.org/guide/scaling-up/state-management.html) distinguishes component state from shared state and explains how shared actions become useful as coordination grows.

The relevant teaching mechanism is to explain the reason for moving a responsibility and keep simpler local behavior legitimate. Marionette's View reference now states that local model/API persistence can remain local, while its Application reference connects readiness to later feature operations. Marionette's classes and lifecycle contracts remain its own; this comparison does not establish equivalent architecture or measured learning outcomes. We have not added an implementation of the exposed task to the docs.

## Earlier records-lesson comparison

Sources accessed 2026-09-28. The findings below concern one runnable list/detail lesson. They do not define the framework documentation map or require future guides to extend that lesson.

### Lesson findings and decisions

| Mechanism | Evidence from official documentation | Target for Marionette |
| --- | --- | --- |
| Explain state ownership through a feature | React's [Thinking in React](https://react.dev/learn/thinking-in-react) develops a product table from a static rendering into an interactive feature. It identifies minimal state, chooses its owner, and adds callbacks for user actions. | Explain why the selected record belongs to the feature owner and how list intent changes detail. Show the actual event and state flow in the runnable source. Avoid creating an Application for each control. |
| Provide a runnable starting point | Vue's [Quick Start](https://vuejs.org/guide/quick-start.html) connects its scaffold to install, development, and production build commands, and offers browser playgrounds. | Supply one frozen setup with exact commands that pass from a clean consumer directory. Explain renderer and data integration once. A hosted playground can wait; a reader must still be able to run and edit the example locally. |
| Make changes to shared state intentional | Vue's [State Management](https://vuejs.org/guide/scaling-up/state-management.html) explains state, views, and actions, then recommends named actions to centralize mutation. | Make one feature owner authoritative for selection and accepted API results. Use `@mnjs/data` for observable data without implying that it supplies a complete remote-data solution. State lifetime follows the feature rather than copying Vue's global-store example. |
| Use normal safe text rendering | Vue documents [automatic escaping](https://vuejs.org/guide/best-practices/security.html#what-vue-does-to-protect-you); Svelte's [HTML lesson](https://svelte.dev/tutorial/svelte/html-tags) distinguishes ordinary text from explicit raw HTML. | Use the chosen renderer's standard interpolation and verify that markup-shaped record values remain text. Do not add an example-only escaping helper. Do not imply that text escaping validates URLs or arbitrary HTML. |
| Teach invalidation with asynchronous work | React's [Effects guide](https://react.dev/learn/synchronizing-with-effects#fetching-data) ignores obsolete responses and explains cleanup. Vue's [watcher cleanup](https://vuejs.org/guide/essentials/watchers.html#side-effect-cleanup) aborts invalidated requests. | For initial readiness, the Application returns its service promise from prepareStart; the framework admits the current result to onStart. Verify departure during preparation, including a service that ignores cancellation. An in-place refresh needs its own later policy. |
| Make the next change small and visible | Svelte's [tutorial introduction](https://svelte.dev/tutorial/svelte/welcome-to-svelte) explains successive exercises with an editable app and a solution. React's table lesson adds behavior in explicit steps. | Within a lesson, keep changes understandable and complete runnable source accessible. Choose later lessons from the framework coverage gaps; they need not extend the records application. |
| Help agents find relevant guidance | Svelte's [AI overview](https://svelte.dev/docs/ai/overview) separates a small instruction entrypoint from documentation retrieval and other tools. | Begin with a short entrypoint linking the relevant versioned Markdown and runnable commands. Test path resolution independently of whether an agent uses the guidance well. |

### Lesson comparison limits

These sources support the direction: explicit state ownership, incremental runnable work, ordinary safe rendering, and cleanup introduced with effects. They do not establish that Marionette's implementation or lesson is equally effective.

React and Vue combine responsibilities in components that Marionette separates into Applications, Views, and Regions. Adopt the clarity of their explanation; assess Marionette boundaries against its own lifecycle and ownership model. Class counts and source length cannot make that comparison.

Svelte remains a useful comparator for exercise structure and discovery. Its compiler-specific static analysis and autofixer are outside this work. No combined Svelte tooling result is being credited to documentation alone. A local runnable example provides a smaller feedback surface than an integrated tutorial, and this difference remains a limitation.

The peer sources are live documentation. Our first consumer will have a frozen package, renderer, and lockfile; that makes our checks reproducible but does not make the peer comparison experimentally controlled. No agents have performed equivalent tasks across these libraries here.

### Historical evidence plan for the records slice

1. **Runnable setup:** a clean consumer installation builds and the documented test command passes. Record package versions and commands.
2. **Working interaction:** browser checks cover initial display, selection, switching details, empty data, and literal text rendering.
3. **Ownership:** a code review traces selection and remote-data effects to their owner, checks View boundaries and Region teardown, and explains why each Application exists. Keep this result separate from passing behavior tests.
4. **Lifecycle:** exercise departure during loading and normal stop/restart. If asynchronous loading is deferred, label this check pending rather than inferring cleanup from synchronous selection tests.
5. **Check sensitivity:** introduce a targeted defect and confirm its acceptance check fails for the expected reason. An unchanged passing suite is not evidence that it detects the claimed failure.
6. **Teaching:** later, fresh controlled agent sessions must build and extend a related feature. This stage's implementation, review, and tests establish example quality; teaching effectiveness remains unmeasured until those sessions run.

### Recorded candidate package follow-through

The new documentation index and llms.txt implement the small-entrypoint approach. A minimal quick start precedes the composed records feature, and focused API/setup pages support contract lookup. The [candidate-package probe](stage-3-package-results.md) checks installed discovery and runnable source with current package artifacts. No framework-specific analysis engine or retrieval service has been added. These checks establish the Marionette mechanisms work locally; they do not compare agent outcomes against peer frameworks.
