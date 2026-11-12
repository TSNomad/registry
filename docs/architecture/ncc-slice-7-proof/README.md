# Slice 7 proof record, registry

This folder holds the evidence that each acceptance test is a contract,
as `../ncc-slice-7.md` describes. The method is the one slice 6 used.
`mutate.py` runs the suite once per mutation in a list and writes a
log. A mutation counts as caught when the suite exits non-zero. Every
run starts with three controls: a break the harness must catch, a
comment it must not, and a syntax error it must refuse to score. Every
log here ends with zero mismatches.

## Architecture, before P2

- `stub-run.log` is the suite with every `skip` removed, run against
  the architecture stubs: 22 tests, 6 fail, the six then marked
  `skip`. The 16 that passed ran on the 0.1 code, or checked the
  package's exports, and stayed as guards. One of them is the empty
  pass `node --test` reports for the compile-only file.
- `mutations.py` and `mutations.log`: 17 entries, three of them
  controls, against a scratch implementation in a separate clone that
  is never committed. Its find texts do not apply to this branch.
- `types-mutate.py`, `type-mutations.py` and `type-mutations.log`: the
  same method for `test/registry-type-safety.ts`. All 4 directives are
  covered. The list targets the final interfaces, so it reruns on this
  branch:

```
python3 docs/architecture/ncc-slice-7-proof/types-mutate.py . test/registry-type-safety.ts docs/architecture/ncc-slice-7-proof/type-mutations.py
```

## Implementation, P2 and the review

- `p2-mutations.py` and `p2-mutations.log`: packet P2's list, 18
  entries, against the committed `get` and `getKeys`.
  `p2-mutations.review-rerun.log` is the review's rerun of it after its
  fix, with the entries that name the changed line updated. It reruns
  on this branch:

```
python3 docs/architecture/ncc-slice-7-proof/mutate.py . docs/architecture/ncc-slice-7-proof/p2-mutations.py
```

- `review-spot-mutations.py` and its log: the slice 7 review's spot
  check of the committed code.
- `review-fix-mutations.py` and its log: the review's proof that its
  unit test fails on the line that started a factory before `get`
  stored its run.

## P5, the re-entrant get rule

- `p5-stub-run.log` is the suite with the four P5 tests unskipped, run
  against this branch's registry: 29 tests, 4 fail, and all four are
  the P5 tests. The self-replacing factory resolves after the test's
  own stop at 20 runs, where it should reject. The self-get and the
  cycle are still pending once the microtask queue drains. The export
  test finds no `ReentrantGetError`. No test hung.
- `p5-architecture-mutations.py` and its log: 13 entries, three of
  them controls, against a scratch P5 in a separate clone that is
  never committed. The scratch passes all 28 tests left once P2's unit
  test that pins the old wait is removed, as P5 does. Each of the 10
  mutations breaks one part of the rule, its error, or its export, and
  each is caught.
