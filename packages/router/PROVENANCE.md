# Source provenance and publication status

This private development package originated from `packages/router` in
RoundingWell/app-frontend at **0c730dceffc60bb5c85ceb31be2ee49f6956dcff**.
This factual source record preserves provenance; the public API, documentation and
examples are generic Marionette v5 routing and contain no application-domain policy.

The receiving branch begins at Marionette master
**909890031209404fd8a375447abf51cc3a35ebfe**. No commits from the separate earlier
History API prototype at **950e4c6dc67ca3e6e378267a95845dc6965eeaa4** were merged.
The initial refinement commits are **1a26e38ba0b431ca272d91ef643e2dfdc306833f** and
**e1884c0657ac08dae5e883d14d879913e054348e**.

The package has since been revised to use Marionette Application construction,
configuration, preparation, extension, notifications and registered-child ownership.
Router owns its routing lifetime; ChildAppSwitcher owns a selectable child group.
ChildAppSwitcher replaces the previous coordinator terminology, and reconstruction
means stop/start of the same registered Application. Match remains plain data; Driver, matching,
redirect, cancellation and readiness machinery remain routing-specific.

Both classes use Marionette's default Application family through ordinary
`.extend()` construction. Runtime-bound constructor factories have been removed;
`canGoBack()` is a regular method rather than a prototype-installed getter.
Router inherits Application lifecycle methods and leaves `prepareStart` to
consumers. Initial route dispatch begins on activation; navigation readiness and
route errors remain separate from Application startup completion.

The original package manifest declared MIT, but its extraction proposal did not
resolve license notice/copyright provenance. No copyright holder or license grant
is invented here. The package stays `private: true`. Resolve source rights and
required license material before public extraction/publication.

Historical reports and browser rehearsals are not fresh certification. A recorded
WebKit traversal destination-state gap concerned redirect forwarding; ordinary
committed traversal can retain current-entry state. This branch does not guess a
browser workaround or claim fresh Safari parity. Build, Node, package and UI fixture
results must identify the tested branch revision; native-browser and real focus/
scroll evidence remain separate requirements.
