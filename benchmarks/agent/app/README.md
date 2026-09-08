# Fieldnotes

Fieldnotes is an original, deliberately small local workspace. Filter its project
list, edit a working note, save with Ctrl+Enter or Command+Enter, and open the shared
help overlay. Notes exist only for the current page session. There is no backend,
account, telemetry, network data request, or persistence claim.

Run `node scripts/agent-benchmark/serve.mjs` from the repository after building. Open
`http://127.0.0.1:4178`. A supplied `--manifest /path/release-evidence.json` serves
exact package inputs. Otherwise the server packs existing build output once.

The shell View owns project, editor, and status Regions. CollectionView owns project
rows and preserves their instances through filtering. A save Behavior scopes keyboard
handling to the editor; a status Behavior owns one subscription. The overlay service
keeps positioning and exclusivity in application code and displays only Views through
a real Region. Page teardown destroys both top-level owners.

The application imports the same public reference modules used by the filter,
shortcut, connection-status, and overlay-switch tasks. The remaining task references
independently demonstrate nested panels, row reordering, async cancellation, optional
MnObject communication, and Application/View state ownership. The app does not
pretend every independent fixture is one production feature.

This is a reference implementation and demonstration, not an agent run or scored
benchmark. Three-engine browser tests exercise filtering, literal-text notes, save
feedback, overlay close, focus return, and absence of page errors.
