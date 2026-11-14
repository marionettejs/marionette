# Renderer counter checkpoint (not a timing benchmark)

Frozen index44a83038, bindings73ab5be8, section rendererd9582314 (precedence-corrected; same fixture counts). Reproduce with `node harness/counters.mjs 200` and `400`.

| Counter | Mount200 | Mount400 | First-edit delta200 | First-edit delta400 |
| --- | ---: | ---: | ---: | ---: |
| Local context notifications |400|800|3|3|
| Token checks |50,400|100,800|180|180|
| Expression evaluations |23,800|47,600|6|6|
| Counted DOM writes |5,800|11,600|5|5|
| Structural changes |4,000|8,000|1|1|

Instrumented renderer work scales linearly for this fixture; first edit is bounded at these sizes. This does not measure all FormKit Core work, root-value copying, all class-observer computations, memory, layout, painting or wall-clock time. Direct Core input is not actual keyboard typing. No within2x Vue or total adapter scaling claim follows.

Fresh real-browser timing remains blocked: cloud command launch failed EPERM before page execution, supported browser URL policy denied file fixture. No Mac automated tests or sandbox weakening used.
