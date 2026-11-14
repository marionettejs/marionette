# Retained setup failures

Initial npm install used default /home/agent/.npm and failed ENOENT creating cache before install. Retried with supported workspace-local npm-cache; exact dependency install succeeded (88 packages). No permissions changed.

Initial JSDOM reference harness launch failed ReferenceError:getComputedStyle not defined at @formkit/themes/dist/index.mjs:56. Added browser global binding plus SVGElement before dynamic imports; all three arms then passed. This was a harness setup failure, not discarded performance sample. No timings were collected.

Conditional-schema harness first revision used synchronous root-commit projection and asserted re-added raw empty value was ''. It exposed harness-induced recursive projection in current adapter and React render-phase update warning; upstream Vue/React re-added value was undefined, rendered empty. Preserved initial logs under schema-conditional-initial. Revised data forwarding batches notifications, suppresses unchanged supplied data, and checks rendered empty plus absence of old value instead of inventing raw-value normalization. Vue/React/current then pass. This conditioning is two-field functional testing, not a timed workload.

Experimental schema first shared-fixture execution correctly rejected an unsupported explicit validationVisibility:'live' key. Writer extending its fixed-live documented subset; original failure retained in schema-conditional-experiment.log until new result uses separate filename.

Full-context shared fixture initially assumed attrs:{placeholder:...} was identical component input vocabulary across adapters; Vue/React did not produce the placeholder while current/experiment did. Probe preserved, not counted as common parity. Common test now covers actual shared help/description, blur, dirty/validation and reset. Initial synthetic blur-only React fixture did not invoke React's focusout delegation; blur+focusout sequence passes all4 arms. Both initial outcomes preserved under react-context-successor, not presented as upstream defects or performance samples.
