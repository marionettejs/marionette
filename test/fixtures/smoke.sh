#!/usr/bin/env bash
# CI installs/builds first through npm ci. Reuse those outputs and pack only once.
set -euo pipefail
cd "$(dirname "$0")/../.."
artifacts=$(mktemp -d "${TMPDIR:-/tmp}/marionette-package-smoke.XXXXXX")
trap 'rm -rf "$artifacts"' EXIT

directories=(.package packages/data packages/adapters packages/utils packages/radio)
flags=(--tarball --data-tarball --adapters-tarball --utils-tarball --radio-tarball)
arguments=()
for index in "${!directories[@]}"; do
  filename=$(cd "${directories[$index]}" && npm pack --ignore-scripts --silent --pack-destination "$artifacts")
  arguments+=("${flags[$index]}" "$artifacts/$filename")
done

# CJS runtime, standalone ESM/CJS, types, bundling/maps, adapters, Backbone lists.
# Full fixture coverage remains on master pushes and release certification.
status=0
for fixture in cjs-node standalone-packages core-types vite cjs-adapters collection-removal-survivors; do
  if ! npm run test:fixtures -- "${arguments[@]}" --fixture "$fixture" \
    --report "test/tmp/fixture-reports/smoke-$fixture.json"; then
    status=1
  fi
done
exit "$status"
