# Slice 7 proof record, registry

This folder holds the evidence that each acceptance test is a contract,
as `../ncc-slice-7.md` describes. The method is the one slice 6 used.

- `stub-run.log` is the suite with every `skip` removed, run against
  this branch's stubs: 22 tests, 6 fail, the six marked `skip`. The
  16 that pass run on the 0.1 code, or check the package's exports,
  and stay as guards. One of them is the empty pass `node --test`
  reports for the compile-only file.
- `mutate.py` runs the suite once per mutation in `mutations.py` and
  writes `mutations.log`: 17 entries, three of them controls, zero
  mismatches.
- `types-mutate.py` does the same for `test/registry-type-safety.ts`,
  from `type-mutations.py` into `type-mutations.log`. All 4 directives
  are covered, with zero mismatches.

Every run starts with three controls: a break the harness must catch,
a comment it must not, and a syntax error it must refuse to score.

`mutations.py` targets a scratch implementation in a separate clone
that is never committed. `type-mutations.py` targets the final
interfaces on this branch, so anyone can rerun it here:

```
python3 docs/architecture/ncc-slice-7-proof/types-mutate.py . test/registry-type-safety.ts docs/architecture/ncc-slice-7-proof/type-mutations.py
```
