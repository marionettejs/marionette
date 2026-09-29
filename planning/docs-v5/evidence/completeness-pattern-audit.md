# Bounded v5 architecture comparison

2026-09-30; read-only source inspection. No private tests or edits. No public documentation changed.

## Private reference snapshot

Inspected private reference HEAD `281504635e65c97ce03a3772795fede5d772e7cf`. Manifest and installed Marionette/adapter versions both 5.0.0-rc.1. Checkout has unrelated dirty work; this is not a clean exact-HEAD application validation. Representative unchanged root/bootstrap, dashboard, flow, schedule page/results and latest-request modules were read. Root guidance and scoped data/routing guidance were read first. Private source paths and domain-specific data names are intentionally omitted here.

The reference uses an explicit API/service layer (registered Radio requests), readiness results from prepareStart, synchronous completion hooks, root and registered-child ownership, error reporting on detached lifecycle Promises, explicit retained refresh operations, and host-loss invalidation. It uses Backbone/Morphdom/Handlebars as deliberate integration choices. Those are not universal framework requirements.

## Findings that merit a small correction

1. `examples/records/src/main-application.js:26-27` returns the child stop Promise to a View trigger callback, whose return is ignored. `onStart:15` also ignores the result of openRecords, and open/retry catches can still reject when their async error-recovery handler fails. This conflicts with `docs/architecture.md:28` and `docs/guides/migration.md:48` telling callers to handle separately started lifecycle failures. The private reference explicitly reports such detached failures. Smallest correction: make the three UI-intent entry methods finish their Promise chains with a terminal error reporter; The UI-intent handlers report terminal failures; child lifecycle methods retain their rejection contract for programmatic callers. Do not add a lifecycle wrapper or service injection. Missing handler does not change ordinary successful execution, so treat as an error-boundary defect rather than evidence the whole example architecture is wrong.

2. `docs/guides/retained-refresh.md:64-65,100-115` verifies Application activity/request authority but does not independently verify root-host survival. This is valid for its sole-owner page; it must not be transferred as a sufficient guard for a host that can disappear before Application stop completes. The existing UI guide already tells hosts to await disposal or use a fresh mount. Smallest useful correction is a short sentence near the refresh authority explanation linking to that host boundary and stating the example assumes its Application owns root replacement/removal. Do not add run/request/host helper objects to this small example.

## Justified differences

- Ready UI built in onStart is a useful simple default. Actual reference also builds loading shells in onBeforeStart, awaits required children in prepareStart, and starts some ongoing refreshes from onStart with explicit error handling. Public architecture already permits those policies and RecordsApplication uses a loading View. No rule should forbid pre-readiness presentation.
- Direct records API import and inline fetch in self-contained testing/TypeScript examples preserve service effects in Application. The private reference's Radio-based auth/cache/dedup service layer is application-specific; reproducing its registry would add unnecessary scaffolding.
- Local list sorting/filtering and model edits stay in Views because those examples have no asynchronous feature readiness or shared navigation decisions. This follows the same responsibility boundaries even though the private reference's large results workflow uses Applications and separate selection objects.
- Native optional data and Lit are deliberate public teaching integrations. Replacing them with the private reference's Backbone and Morphdom would violate the user's stated public data preference. Native data incompleteness/API separation is consistently identified.
- The private rc.1 reference contains explicit destroyed-source stopListening handlers. Public rc.2's newer terminal event cleanup removes that need; do not copy those redundant handlers.
- Explicit refresh preserves the shell and separately replaces/updates affected data; restart ends the run and reconstructs root UI. Public documents state this accurately. Native reset rebuilding rows is explicitly documented rather than presented as identity-preserving refresh.
- Local DOM selectors inside a View are allowed by the public contract. The private reference prefers ui/getUI for owned template elements as a maintainability convention; adopt where it simplifies the example, without claiming selectors are an invalid API.

## Limits

No real consumer migration, runtime/browser test, release validation, or reader effectiveness measurement performed in this audit. Current private branch is not a frozen reference; installed rc.1 differs from public rc.2. Public guides' standalone endpoints intentionally omit real authentication, caching, schema and persistence policies. Those integration choices must be supplied by a consumer, not inferred from these examples.
