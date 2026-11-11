# File equality limit

Core 2.5.0 still treats distinct Files with identical name, size, type and
lastModified as equal and retains the older object. This was reproduced through
bare public Core input and the retained strict native FieldView diagnostic.
Different contents alone do not establish a distinct Core value.

`known-core-file-equality.spec.mjs` keeps the strict reference assertion. It is a
separate, deliberately failing diagnostic, not a passing canonical gate or a
guarantee of callback recovery. A JSDOM Vitest configuration can run it with the
same public package/source aliases as the normal suite. Passing normalizer tests
prove delivery of proposals; they do not eliminate Core's later equality check.

The original 2.1.2 evidence and complete older note remain in
[immutable history](https://github.com/marionettejs/marionette/blob/9b031550bb2737f052896ee0a0bfe032a54d5b55/packages/formkit/acceptance/KNOWN-CORE-FILE-EQUALITY.md).
No vendor patch, hidden value metadata or temporary blank write is used to make
this diagnostic pass.
