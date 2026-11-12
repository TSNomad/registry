# Registry reshape toward PHPNomad

Status: architecture. `CanGet`, `CanSet` and `CanDelete` are final.
`Registry.get` keeps its 0.1 body and `getKeys()` answers an empty list,
both stubs that packet P2 implements. Every acceptance test is written,
and the tests the stubs cannot pass are marked `test.skip`.

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
container tokens, so the registry keeps no dependency on the container,
and a token named `CanGet` would collide across every registry in an
app.

`get` gets a firmer contract, which P2 implements:

- The factory runs once per entry. Concurrent first gets share that
  run and receive the same item. 0.1 ran the factory once per
  concurrent get.
- Whatever the factory answers is the item, null and undefined
  included, and later gets serve it, as PHPNomad's registry marks an id
  initialized. 0.1 ran the factory again for a null item.
- A factory that throws caches nothing. Every get waiting on that run
  gets its error, and the next get runs the factory again.
- A run belongs to the entry that started it. When `replace`, `delete`
  or `clear` removes the entry mid-run, the result never lands on a
  later entry under the same key.

`getAll()` builds through the same path as `get`, so a get and a
`getAll` in flight share one run.

## Where this differs from PHPNomad

- `get` and `getAll` return promises, because a factory may be async.
- `get` of a missing id throws `KeyNotFoundError`, as 0.1 does.
  PHPNomad answers null.
- `set` of an id already set throws `DuplicateKeyError`, as 0.1 does.
  PHPNomad overwrites. `replace` overwrites on purpose.
- `getAll` answers an array in key order, as 0.1 does. PHPNomad answers
  an array keyed by id, which `getAllEntries()` gives here.

Nothing breaks for 0.1 consumers. Code that leaned on a factory running
again for a null item, or for each concurrent get, sees one run.

## Decisions

The assumptions log records each call in the range A220 to A239.

## Packets

- P2, `Registry.get` and `getKeys` (`src/Registry.ts`). Mostly
  mechanical.

The loader repository's note covers P1 and P3.

## Proof

`ncc-slice-7-proof/` holds the mutation lists and logs, run against a
scratch implementation in a separate clone that is never committed,
with every `skip` removed. See that folder's README.
