# Marionette agent guidance

Follow the canonical repository instructions in [AGENTS.md](../AGENTS.md), the
[test guide](../test/README.md), and [ROADMAP.md](../ROADMAP.md). Tests and fixtures
must use public package entrypoints and observable behavior, with no private
framework access. Keep agent tooling out of production imports and report only
validation that actually ran.
