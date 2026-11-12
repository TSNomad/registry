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

Only the promises are forced by TypeScript. The other three keep 0.1
behavior for current consumers and are open gaps under
[TS Nomad Alignment With PHPNomad (Charter 5012)](https://navigator.novatori.us/r/charter/5012),
to close in a breaking release.

## Extracted 2026-09-17

This package was extracted on 2026-09-17 from a prototype carried inside
three Novatorius CLIs.

## License

MIT.
