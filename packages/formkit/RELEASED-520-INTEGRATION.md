# Testing against Marionette 5.2.0

The FormKit package is not part of the root npm workspace. Install both lockfiles
from the repository root; the root dependencies supply the shared lint tools.

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm --prefix packages/formkit ci --ignore-scripts --no-audit --no-fund --workspaces=false
npm --prefix packages/formkit run check
npm --prefix packages/formkit run coverage
```

The package lock installs released Marionette, Radio and Utils 5.2.0 and
FormKit 2.9.0. The package check verifies the binding adaptation, lint, build,
tests, TypeScript declarations, and packed ES module and CommonJS consumers.

The [FormKit GitHub Actions workflow](../../.github/workflows/formkit.yml) runs
these checks and exercises the packed builds in a browser against the matching
Vue and React integrations. The stock browser fixtures do not certify licensed
inputs, assistive technologies or application-specific behavior.
