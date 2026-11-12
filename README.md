# @tsnomad/registry

A registry for named collections that load lazily. Set a factory under a key,
and the registry only calls it the first time that key is read, then caches
the result. It also carries metadata per key, so callers can find items by
tag or sort them by priority.

This is the TypeScript counterpart to PHPNomad's
[registry](https://github.com/phpnomad/registry) package, the framework that
TSNomad follows in shape and naming.

## Install

```bash
npm install @tsnomad/registry
```

## Use

```ts
import { Registry } from '@tsnomad/registry';

const strategies = new Registry();
strategies.set('claude', () => new ClaudeStrategy());
const claude = await strategies.get('claude');
```

## Where this differs from PHPNomad

`Registry` implements PHPNomad's `CanGet`, `CanSet` and `CanDelete`,
with these differences:

- `get` and `getAll` return promises, because a factory may be async.
- `get` of a missing id throws `KeyNotFoundError`. PHPNomad answers
  null.
- `set` of an id already set throws `DuplicateKeyError`. PHPNomad
  overwrites. Use `replace` to overwrite.
- `getAll` answers the items in key order. `getAllEntries` answers the
  record keyed by id, as PHPNomad's `getAll` does.
- PHPNomad's registry is three traits over an array of objects. Here
  it is one `Registry<T>` class, and an item may be any type.
- A factory must not read its own key. Until the pending re-entrant
  rule lands, such a get waits forever, and a factory that replaces
  its own key and then gets it loops and pins the CPU. With the rule,
  each of these rejects with a `ReentrantGetError` that names the keys.
  The rule uses `AsyncLocalStorage` from `node:async_hooks`, so the
  registry then needs Node, Deno or Bun.

The promises and the one class are forced by TypeScript. The missing
id, the duplicate set and the `getAll` shape keep 0.1 behavior for
current consumers and are open gaps under
[TS Nomad Alignment With PHPNomad (Charter 5012)](https://navigator.novatori.us/r/charter/5012),
to close in a breaking release.

## Extracted 2026-09-17

This package was extracted on 2026-09-17 from a prototype carried inside
three Novatorius CLIs.

## License

MIT.
