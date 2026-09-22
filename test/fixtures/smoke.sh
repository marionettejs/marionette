#!/usr/bin/env bash
# CI installs/builds first through npm ci. Reuse those outputs and pack only once.
set -euo pipefail
cd "$(dirname "$0")/../.."
artifacts=$(mktemp -d "${TMPDIR:-/tmp}/marionette-package-smoke.XXXXXX")
trap 'rm -rf "$artifacts"' EXIT

directories=(. packages/data packages/adapters packages/utils packages/radio)
flags=(--tarball --data-tarball --adapters-tarball --utils-tarball --radio-tarball)
arguments=()
for index in "${!directories[@]}"; do
  filename=$(cd "${directories[$index]}" && npm pack --ignore-scripts --silent --pack-destination "$artifacts")
  arguments+=("${flags[$index]}" "$artifacts/$filename")
done

# CJS runtime, standalone ESM/CJS, installed declarations, bundling/maps, adapters.
# Full fixture coverage remains on master pushes and release certification.
for fixture in cjs-node standalone-packages core-types vite cjs-adapters; do
  npm run test:fixtures -- "${arguments[@]}" --fixture "$fixture" \
    --report "test/tmp/fixture-reports/smoke-$fixture.json"
done
