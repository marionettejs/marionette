# Isolated composition experiment

This manifest experiment has no package export and is not shipped in runtime or
declaration artifacts. It remains available for design evaluation alongside its
unchanged private test entry, `test/unit/formkit-manifest-prototype.spec.js`.

Run `npm test -- test/unit/formkit-manifest-prototype.spec.js` from the repository.
The normal type check includes this source explicitly. `npm run coverage` also
includes it explicitly at 100% for every metric, alongside all production source.
The source move changes no thresholds or exceptions and removes no test outcomes.

The supported production model remains FormView, ordinary Views/Collections,
FieldView, RowView, SchemaView and named runtime registrations. The experiment
still uses FormView's existing protected seams; those declarations remain intact.
Historical experiment contracts, source hashes and failed/accepted evidence remain
in the local handoff and prior commits. Relocation prevents orphan experimental
declarations from entering the package; it makes no runtime bundle-size claim.
