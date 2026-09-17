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

## Extracted 2026-09-17

This package was extracted on 2026-09-17 from a prototype carried inside
three Novatorius CLIs.

## License

MIT.
