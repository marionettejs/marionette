# Preparing @mnjs/html 1.0.0

This is an independently versioned package. The repository's coordinated core
release workflow explicitly publishes five other packages; do not add HTML to
that release or invoke it to publish HTML. A publishable manifest is not approval
to publish. No command below uploads a package, creates a tag or changes npm.

## Candidate verification (repository checkout)

Use the pinned repository Node/npm toolchain, then:

```sh
node packages/html/scripts/check-lockfile.mjs
npm ci --ignore-scripts
npm --prefix packages/html ci --ignore-scripts
npm run lint:html
npm run coverage:html
npm run test:html:current-core
npm --prefix packages/html run check
npm --prefix packages/html run test:packed:browser
mkdir -p packages/html/artifacts
npm pack ./packages/html --ignore-scripts --pack-destination packages/html/artifacts
```

`check` validates licenses, fixture integrity, export targets, declarations and
runtime behavior from extracted packed files under default/development conditions.
JSDOM is an external test host, not an undeclared renderer dependency. Packed
browser checks use those package export mappings and extracted renderer files in
Chromium, Firefox and WebKit. Test fixtures and comparison dependencies stay
outside the archive. Record the exact commit, tarball SHA-256/SRI and check results.
Do not rebuild or change documentation after freezing the candidate without
repacking and updating its identity and integration evidence.

## Gates before an actual publication

- Exact candidate CI, review and CodeQL disposition must be complete. Fixture-only
  findings require evidence-based triage, not weaker scan configuration.
- Validate the exact frozen archive in the consuming application, not the old
  prototype archive. State the Marionette version and app revision actually tested.
- An authorized maintainer must verify npm ownership of `@mnjs`, package-name and
  version availability, registry destination and intended dist-tag. These remote
  prerequisites have not been established by local checks.
- Select and review the package-specific publication route, authentication and
  provenance requirements. No HTML trusted-publisher workflow is configured here.
  Credentials and account authorization are separate from package metadata.
- Obtain explicit authorization for publishing the exact reviewed archive. Git
  tags/releases, core releases and deployments require their own authorization.

After an authorized publication, verify registry version, dist-tag and tarball
integrity against the approved artifact, then smoke-test the registry archive.
No registry content or publication success is claimed by this preparation.

## Withdrawal / rollback limits

There is no earlier published HTML release established by this work. Do not
promise rollback to an unknown version. npm versions are immutable in ordinary
use; a defect may require a corrective version and application dependency rollback
or version pin. Dist-tag moves/deprecation and any unpublish action require a
separate reviewed decision under npm's applicable policy. Preserve the source and
artifact identities needed to reproduce every candidate.
