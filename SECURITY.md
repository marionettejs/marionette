# Security reports and version support

Report suspected vulnerabilities privately through
[GitHub's security advisory form](https://github.com/marionettejs/marionette/security/advisories/new).
Do not include exploit details, credentials or private application data in a public
issue. Include the affected package and exact version, a minimal reproduction,
the expected trust boundary and the observed impact. Redact sensitive data.

This repository maintains `marionette` and the `@mnjs/data`, `@mnjs/adapters`,
`@mnjs/utils` and `@mnjs/radio` packages. Maintainers review private reports and
coordinate fixes and disclosure through the advisory. Ordinary bugs and support
questions belong in the [issue tracker](https://github.com/marionettejs/marionette/issues).

Current development targets v5, which is in beta. A prerelease is not a stable
support commitment. Reports about older releases should identify the affected
version and whether the problem reproduces on the current beta; do not upgrade a
production application solely to investigate a report. This community-maintained
project does not promise a response deadline or automatic backports. A backport
or supported-version window must be stated in the relevant release or advisory.

For application authors, [rendering untrusted content safely](docs/security.md)
describes the application's responsibilities. Reporting a vulnerability does not
require demonstrating an issue in a real deployment; a minimal isolated example
is sufficient.
