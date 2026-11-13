# Changelog

## 0.2.0

- Add the public `@mnjs/router/history` entry, exporting the named
  `historyDriver` factory in ESM and CommonJS with matching declarations.
  Applications can dynamically import this entry when the Navigation API is
  absent, before starting Router.
- Preserve every existing root named export, including `historyDriver` and
  `navigationDriver`, and preserve native driver selection and runtime behavior.
  The standalone History entry is built independently from the same source;
  its factory has a distinct identity from the root factory.
- Document capability preparation, production graph verification, and excluding
  History-only assets from eager preload and service-worker install precaching
  while retaining runtime script caching.

This is an independently versioned Router minor release. Applications using
`^0.1.1` must explicitly update their dependency range to adopt 0.2.0. The
Marionette peer and Utils dependency remain `^5.0.1`; the Node floor remains
24.15.0.

See the [README](readme.md#download-history-only-when-needed) for the entry contract,
application requirements, browser evidence and direct unbundled root limitation.
