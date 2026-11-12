# Registry reshape toward PHPNomad

Status: implemented. Packet P2, the implementation task for the
registry, built `get` and `getKeys()`. The slice 7 review fixed one
fault in it, and the factory now starts one microtask after `get`
stores its run, so a get that arrives first shares that run. Packet P5
makes every get of a key from inside that key's own run reject with a
`ReentrantGetError`, since a loud failure is better than a hang. Every
test runs and passes.

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

- `CanGet<T>`: `get(id)`, `getAll()` and `getKeys()`, which PHPNomad's
  `CanGet` has and the 0.1 registry lacked.
- `CanSet<T>`: `set(id, factory)`.
- `CanDelete`: `delete(id)`.

`Registry<T>` implements all three. They are types only, with no
container tokens. Many registries implement one interface in an app,
so a token named `CanGet` would point at only one of them. Types only
is the rule for an interface many instances implement, and it also
keeps the registry free of a container dependency.

`get` gets a firmer contract, which P2 and P5 implement:

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
- A get of a key from inside that key's own factory run, while the
  run is in flight, rejects with a `ReentrantGetError` (packet P5).
  That covers a factory that gets its own key, a cycle through other
  keys' factories, and a factory that replaces its own key and then
  gets it. The error is a `RegistryError`. It carries the key and the
  path of keys that led back to it, such as `['a', 'b', 'a']`, and its
  message names every key on the path. The run fails with it and
  caches nothing, so every get waiting on the run rejects too. Work
  the factory starts counts as inside the run until the run settles.
  A get from a microtask the factory queued and never awaited, made
  while the run is in flight, rejects as re-entrant, though waiting
  there would not deadlock. The same work reading the key after the
  run settled is not re-entrant, and it gets the item.
- The registry tracks the run a get comes from with `AsyncLocalStorage`
  from `node:async_hooks`, which follows a call across `await`. That
  makes the registry need a runtime that has it: Node, Deno or Bun.
  A cycle is caught along the runs one get started. Two
  outside gets that start the two halves of a cycle at the same time
  can still wait on each other, so build dependency graphs in the
  container, which detects loops, and keep registry factories to one
  item each.

`getAll()` and `getAllEntries()` read the keys set when they start
and get them one at a time, in key order, through `get`. They share
runs with gets in flight, reject with the error of the first key that
fails, and reject with `KeyNotFoundError` for a key deleted before its
turn.

The registry logs nothing. Each failure reaches the caller as a
rejection, and the caller logs it.

## Where this differs from PHPNomad

TypeScript forces these:

- `get` and `getAll` return promises, because a factory may be async.
- PHPNomad's registry is three traits, `WithGet`, `WithSet` and
  `WithDelete`, over a protected array that any class can mix in.
  TypeScript has no traits, so TS Nomad has one `Registry` class that
  implements the three interfaces.
- PHP's `get` answers `?object`, so an item is an object or null.
  `Registry<T>` holds any type, a string or a number included.
- PHP stores the callable under the id and swaps it for its result on
  the first `get`. The TS registry keeps the factory and the item side
  by side on an entry, which lets a run belong to the entry that
  started it.
- PHP ids may be strings or integers. TS ids are strings, since a
  JavaScript object key is one.
- A PHP factory that gets its own id calls itself until the stack
  overflows. The TS registry rejects that get with a
  `ReentrantGetError`. PHP has no async run to wait on, so it fails
  loudly too.

The registry also keeps its 0.1 additions, which PHPNomad lacks:
`replace`, `has`, `keys`, per-key metadata with tags and priority,
`getMetadata`, `findByMetadata`, `findByTag`, `keysByPriority`, `getAllEntries`,
`clear` and `size`. They add to PHP's interfaces and change none of
them.

Three more keep 0.1 behavior that the current consumers rely on.
TypeScript does not force them, so they are open gaps under
[TS Nomad Alignment With PHPNomad (Charter 5012)](https://navigator.novatori.us/r/charter/5012).
The loader's breaks in this slice fail loudly, at compile time or with
an error at load. Closing these three would break consumers without a
sound: `get` would answer null where they expect an item or an error,
and `set` would replace an item where they expect a refusal. Charter
5012 sends a consumer break to Alex, so these wait for his call.

- `get` of a missing id throws `KeyNotFoundError`. PHPNomad answers
  null.
- `set` of an id already set throws `DuplicateKeyError`. PHPNomad
  overwrites, though only before the first read. Its `WithGet` keeps an
  initialized flag that `set` and `delete` never clear, so after a read
  a new `set` makes `get` answer the stored closure. Closing this gap
  copies the intent, not that bug, which is filed as
  [Conversation 11037](https://navigator.novatori.us/r/conversation/11037).
  `replace` overwrites on purpose.
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
| `src/Registry.ts` | `Registry`, with `get` and `getKeys` built by P2 and the re-entrant check built by P5 |
| `src/errors.ts` | 0.1's errors, and P5's `ReentrantGetError` |
| `src/index.ts` | the package root, which exports `ReentrantGetError` too |
| `src/types.ts` | unchanged from 0.1 |

## Acceptance tests

| File | Tests | What it proves |
|---|---|---|
| `test/registry-get.test.ts` | 14 | one factory run, also under concurrency, caching null and undefined, failures, replace, delete and clear mid-run, `getAll` and `getAllEntries` sharing runs, failing and missing keys |
| `test/registry-interfaces.test.ts` | 6 | the three interfaces, `getKeys` order, the 0.1 behavior that stays |
| `test/registry-reentrant-get.test.ts` | 4 | P5: a self-replacing factory, a self-get synchronous and after an await, a cycle through another key, each rejecting with `ReentrantGetError`, and a get after the run settled serving the item |
| `test/package-exports.test.ts` | 2 | the public entry points, imported by package name, and the `ReentrantGetError` export |
| `test/registry-type-safety.ts` | 4 rejected calls | compile-only: factory types, `get` answering a promise, item types |

That is 26 acceptance tests at run time. Beside them run 8 unit tests
in `test/registry-build.test.ts`. P2 wrote the first. P5 wrote seven:
the factory starting one microtask after `get` stores its run, a
failed run marking its frame settled, one run context per registry,
the path a `ReentrantGetError` carries, a settled run dropping out of
that path, a factory that deleted its own key, and a get that stays
re-entrant after an outside get built the key. `npm test` reports 35:
the 34 runtime tests and the compile-only file as an empty pass. All
35 pass.
The concurrency tests wait with `setImmediate`, which runs once every
pending promise job has run, so no test depends on a timer. No
re-entrant test can hang, even on a registry without the rule: each
stops its own loop or reads the outcome after the microtask queue
drains.

## Packets

- P2, `Registry.get` and `getKeys` (`src/Registry.ts`). Done.
- P5, the re-entrant get rule: `ReentrantGetError` in `src/errors.ts`
  and the package root, and the check in `get`, which the four tests
  above pin. Done.

The loader repository's note covers P1, P3 and P4.

## Proof

The proof folder (`ncc-slice-7-proof/`) holds the mutation lists and
their logs. The architecture lists ran against scratch implementations
in separate clones that are never committed, with every `skip` removed.
P2's and P5's lists, and the review's spot and fix lists, ran against
the committed code. That folder's README gives the counts.
