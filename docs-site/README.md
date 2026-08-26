# Documentation publication

This directory contains the small amount of content and styling that surrounds the
Markdown reference documentation in `docs/`. Run `npm run docs:check` to build the
site into the ignored `.docs-site/` directory and validate its internal links and
anchors.

The intended public domain is `https://docs.marionettejs.com`. Repository changes do
not create DNS records or enable GitHub Pages. Deployment remains disabled until a
maintainer configures the domain and Pages environment, verifies HTTPS, and sets the
repository variable `DOCS_PAGES_ENABLED` to `true`.

## Route contract

- `/next/` is generated from the current `docs/` directory.
- `/v5/` is reserved for the latest stable v5 documentation.
- `/releases/<version>/` is reserved for immutable release documentation.
- `/errors/<code>/` is reserved for version-neutral diagnostic pages. Published
  diagnostic codes are never removed or reused.

The stable and release routes are intentionally placeholders until the corresponding
release inputs exist. The legacy website and v4 documentation at `marionettejs.com`
remain owned and deployed separately.

External links are not requested during CI. The validator checks every generated
internal page and anchor deterministically; deployment smoke checks should verify the
public HTTPS routes after Pages is enabled.
