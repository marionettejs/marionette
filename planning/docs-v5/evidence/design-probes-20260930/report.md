# Short documentation design probes

Completed September 30, 2026 (Asia/Seoul). Four fresh native subagents, two older-documentation readers and two current-documentation readers, plus one independent sketch reviewer. No OpenRouter or Claude CLI calls, builds, browser runs, or public-documentation changes.

## Result

**All four revised sketches use Application preparation and feature-owned requests. This exercise did not reproduce the Stringent ownership failure, and it does not establish an old-versus-new winner.**

The initial request asked for a document-library design with title editing, retained drafts/saves across editor replacement, filtering, refresh, and feature stop. It asked participants to identify owners but did not name Application or prescribe its use. Each participant first answered without documentation, then revised after reading its assigned corpus, then answered a neutral interview. Only the final follow-up explicitly compared Application, a retained root View, and a plain controller.

| Observed design choice | Older docs: P1/P4 | Current docs: P2/P3 |
| --- | --- | --- |
| Surviving feature owner before docs | 2/2 | 2/2 |
| Explicit `Application.extend` and `prepareStart` after docs | 2/2 | 2/2 |
| Requests/drafts outlive disposable editors | 2/2 | 2/2 |
| Regions and CollectionView in revised wiring | 2/2 | 2/2 |
| List filtering choice | Separate filtered collection | `CollectionView.setFilter` |
| Important behavior left in helpers/prose | 2/2 | 2/2 |
| Executable correctness established | Unverified | Unverified |

These counts describe four sketches, not estimates of success rates. Initial sketches already favored a feature owner: P1 used a generic coordinator, P2 an application/controller, and P3/P4 explicitly mentioned Application while marking v5 integration uncertain. None initially showed `prepareStart` wiring.

## What the interviews add

- Both older-doc readers cited **application-composition / Choose the owner before writing the async function** for replacing custom startup with native preparation. Their revised designs also used the documented `createLatestRequest` application helper.
- P2 cited **records / Prepare, then display**, specifically the absence of a separate startup run flag/controller. P3 cited the CollectionView filtering contract for removing a separate filtered projection. Both current-doc readers used `setView` → `showChildView` → `showView` and described automatic destroyed-View cleanup.
- All four described the same boundary: editor closure destroys presentation while the feature retains the draft and pending request; feature stop revokes completion authority. They also identified substantial custom work that Application does not supply: draft reconciliation, save serialization, refresh ordering, and post-start completion guards.
- All four acknowledged that asking for owners foregrounded architecture and that the 35-line limit concealed central implementation in helpers. These are self-reports consistent with the visible omissions, not recovered explanations of the earlier Claude candidates.

The [independent assessment](assessment.md) confirms the ownership choices while distinguishing visible guards from promised behavior. In particular, P2 delegates both post-start paths to helpers; P3 shows request/run checks but leaves observable store implementation undefined. The older sketches likewise omit core bindings and reconciliation. No sketch proves focus preservation or full event delivery.

## What this changes about the diagnosis

The current documentation can support the intended architectural choice when a fresh agent is directed to its entry point and asked to design ownership. A blanket explanation that agents cannot understand Application is too strong.

Combined with the historical prompt difference, this supports a **hypothesis** that task framing, documentation entry, and the move from design into implementation are important. It does not isolate those factors: these participants were native subagents rather than the Claude model used by Stringent, and this exercise explicitly asked for a design instead of a working product.

Current-doc readers found a simpler presentation-filtering API in this sample. That is a concrete favorable observation, not proof that the current documentation is generally better. Older docs also produced appropriate ownership. We should preserve their results as useful evidence without restoring their entire structure or helper patterns.

## Recommended next small test

Keep the public docs unchanged for now. Use the same model as Stringent for a short implementation comparison with the same current docs and product requirement. Vary only whether the agent is first asked to identify lifetimes and owners; do not name Application. Require one concrete save → editor close → completion → reopen path with real observable bindings, rather than a complete app or broad pseudocode skeleton.

That tests whether planning changes implementation choices. It remains a diagnostic; behavior must later be checked before any effectiveness claim. This document-library task is now exposed material and must not be called a holdout.

## Limits and verification

- Two participants per corpus, same inherited native model, no model override. Exact runtime model identifier and usage cost were not returned by the subagent tool.
- `fork_turns=none`; isolation from other files/history was instructed, not enforced by an OS sandbox. The independent reviewer was not blinded: the allowed protocol contained condition assignments.
- Same-session revisions can anchor on the initial design. The request foregrounded ownership and specified lifetimes more clearly than many ordinary tickets.
- At most six documentation files and 64,000 requested characters per participant. Reading logs are participant reports; both older-doc readers reported truncated tool output and targeted rereads. No complete raw tool-read trace was exported.
- Documentation differs in organization, size, examples, and runtime-era cleanup contracts. No common runtime was executed. Historical explicit listener cleanup is not scored as a current-doc regression.
- All 16 saved stage outputs satisfy the requested word limits and JavaScript line limit by a local counting check. Source archive hashes, corpus file hashes, exact prompt templates, and output hashes are preserved in [evidence.json](evidence.json).
- No generated application was installed or run. No architecture or behavioral pass is claimed. No commit or push was made.

## Complete participant records

- [P1: older docs](participants/p1.md)
- [P2: current docs](participants/p2.md)
- [P3: current docs](participants/p3.md)
- [P4: older docs](participants/p4.md)
