# Marionette agent plugin

This plugin has its own release version, shared by `plugin.json` and
`.claude-plugin/plugin.json`. Bump both for plugin changes; the framework npm
version does not change. The loader uses the application's installed guidance.

## Keep it updated

For a Git marketplace tracking `master`:

```sh
codex plugin marketplace upgrade marionettejs
codex plugin add marionette@marionettejs
```

The first command refreshes the marketplace snapshot; the second refreshes the
existing installed plugin with the same identity. Check the installed version with
`codex plugin list --marketplace marionettejs`. Check the source with
`codex plugin marketplace list`. A commit-pinned marketplace
stays pinned. To switch an existing pin to the current branch, use the CLI's
remove/add sequence (the plugin keeps its `marionette@marionettejs` identity):

```sh
codex plugin marketplace remove marionettejs
codex plugin marketplace add marionettejs/marionette --ref master --sparse .agents/plugins --sparse plugins/marionette
codex plugin add marionette@marionettejs
```

For a local-folder marketplace, pull the checkout or replace the copied plugin
folder that its entry points to. Workspace imports use the admin **Sync now**
flow. Restart ChatGPT when convenient after refreshing local files and verify the
plugin version. Installing or updating this plugin does not upgrade npm packages.
See [local and Git marketplaces](https://developers.openai.com/plugins/build/plugins#add-a-marketplace-from-the-cli)
and [workspace updates](https://learn.chatgpt.com/docs/enterprise/plugin-management#keep-plugins-up-to-date).

## Branding and checks

`assets/marionette-mark.svg` preserves the root mark's paths and colors, centered
on a square canvas. Its white tile keeps the crimson artwork visible in both
light and dark themes, so it does not need separate dark assets. Both listing
logo and composer icon use this bundled file.

Run `node --test test/agent-docs/plugin.test.mjs` from the repository root to check
manifest parity, bundled branding, marketplace wiring, and loader behavior.
The [official icon requirements](https://developers.openai.com/plugins/deploy/submission#icons-and-screenshots)
require square icons at least 48 by 48, no larger than 5 MiB.
