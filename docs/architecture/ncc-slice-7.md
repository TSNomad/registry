# Registry reshape toward PHPNomad

Status: architecture. `CanGet`, `CanSet` and `CanDelete` are final.
`Registry.get` keeps its 0.1 body and `getKeys()` answers an empty
list. Both are stubs that packet P2, the implementation task for the
registry, fills in. Every acceptance test is written, and the tests the
stubs cannot pass carry `test.skip`.

This is slice 7 of the Siren Node commerce connectors build, the
registry half. The loader half lives in the loader repository, in its
own `docs/architecture/ncc-slice-7.md`, on the branch of the same name.
The design behind it is
[Design: Siren Node commerce connectors (Source 16182)](https://navigator.novatori.us/r/source/16182),
and the rule it follows is
[TS Nomad Mirrors PHPNomad (KB 854)](https://navigator.novatori.us/r/kb/854).

## What changes

The registry gains PHPNomad's three interfaces, as TypeScript types.

```ts
const strategies: CanGet<Strategy> & CanSet<Strategy> = new Registry<Strategy>();
strategies.set('claude', () => new ClaudeStrategy());
const claude = await strategies.get('claude');
strategies.getKeys(); // ['claude']
```

- `CanGet<T>`: `get(id)`, `getAll()` and the new `getKeys()`.
- `CanSet<T>`: `set(id, factory)`.
- `CanDelete`: `delete(id)`.

`Registry<T>` implements all three. They are types only, with no
container tokens. Many registries implement one interface in an app,
so a token named `CanGet` would point at only one of them. Types only
is the rule for an interface many instances implement, and it also
keeps the registry free of a container dependency.

`get` gets a firmer contract, which P2 implements:

- The factory runs once per entry. Concurrent first gets share that
  run and receive the same item. 0.1 ran the factory once per
  concurrent get.
- Whatever the factory answers is the item, null and undefined
  included, and later gets serve it, as PHPNomad's registry marks an id
  initialized. 0.1 ran the factory again for a null item.
- A factory that throws caches nothing. Every get waiting on that run
  gets its error, and the next get runs the factory again. The registry
  never retries on its own. A caller owns any retry limit or backoff.
- A run belongs to the entry that started it. When `replace`, `delete`
  or `clear` removes the entry mid-run, the result is never stored on
  a later entry under the same key.

`getAll()` and `getAllEntries()` read the keys set when they start
and get them one at a time, in key order, through `get`. They share
runs with gets in flight, reject with the error of the first key that
fails, and reject with `KeyNotFoundError` for a key deleted before its
turn.

The registry logs nothing. Each failure reaches the caller as a
rejection, and the caller logs it.

## Where this differs from PHPNomad

TypeScript forces one difference:

- `get` and `getAll` return promises, because a factory may be async.

Three more keep 0.1 behavior that the current consumers rely on.
TypeScript does not force them, so they are open gaps under
[TS Nomad Alignment With PHPNomad (Charter 5012)](https://navigator.novatori.us/r/charter/5012).
Closing them breaks those consumers, which needs the version bump this
build defers to the merge to main.

- `get` of a missing id throws `KeyNotFoundError`. PHPNomad answers
  null.
- `set` of an id already set throws `DuplicateKeyError`. PHPNomad
  overwrites. `replace` overwrites on purpose.
- `getAll` answers an array in key order. PHPNomad answers an array
  keyed by id, which `getAllEntries()` gives here.

Nothing breaks for 0.1 consumers. Code that leaned on a factory running
again for a null item, or for each concurrent get, sees one run.

## Decisions

Each call made for this slice is in the build's assumptions log, A220
to A239, which lives in the private run folder. The ones a reader of
this repository needs are above: types-only interfaces, the one-run
`get` contract, sequential `getAll`, and the three 0.1 behaviors kept
as open gaps. The package version stays 0.1.0 on this branch.

## Files

| File | Role |
|---|---|
| `src/CanGet.ts`, `src/CanSet.ts`, `src/CanDelete.ts` | PHPNomad's registry interfaces, final |
| `src/Registry.ts` | `Registry`, with `get` and `getKeys` as stubs for P2 |
| `src/errors.ts`, `src/types.ts` | unchanged from 0.1 |

## Acceptance tests

| File | Tests | What it proves |
|---|---|---|
| `test/registry-get.test.ts` | 14 | one factory run, also under concurrency, caching null and undefined, failures, replace, delete and clear mid-run, `getAll` and `getAllEntries` sharing runs, failing and missing keys |
| `test/registry-interfaces.test.ts` | 6 | the three interfaces, `getKeys` order, the 0.1 behavior that stays |
| `test/package-exports.test.ts` | 1 | the public entry points, imported by package name |
| `test/registry-type-safety.ts` | 4 rejected calls | compile-only: factory types, `get` answering a promise, item types |

That is 21 runtime tests. `npm test` reports 22, because it also counts
the compile-only file as an empty pass. The concurrency tests wait with
`setImmediate`, which runs once every pending promise job has run, so
no test depends on a timer.

## Packets

- P2, `Registry.get` and `getKeys` (`src/Registry.ts`). Mostly
  mechanical.

The loader repository's note covers P1 and P3.

## Proof

The proof folder (`ncc-slice-7-proof/`) holds the mutation lists and
their logs, run against a scratch implementation in a separate clone
that is never committed, with every `skip` removed. That folder's
README gives the counts.
