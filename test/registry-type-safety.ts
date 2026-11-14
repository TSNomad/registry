/**
 * Compile-only checks for the registry interfaces. Not a runtime test.
 * Everything sits inside functions that never run, so `node --test`
 * reports this file as an empty pass, and `npm run typecheck` is what
 * makes it matter. Each `@ts-expect-error` line must stay an error, and
 * every other line must keep compiling.
 */

import { Registry } from '../dist/Registry.js';
import type { CanDelete, CanGet, CanSet } from '../dist/index.js';

interface Strategy {
  run(): string;
}

export function registryChecks(registry: Registry<Strategy>): void {
  const reader: CanGet<Strategy> = registry;
  const writer: CanSet<Strategy> = registry;
  const deleter: CanDelete = registry;

  writer.set('claude', () => ({ run: () => 'c' }));
  writer.set('codex', async () => ({ run: () => 'x' }));
  void reader.get('claude').then((strategy: Strategy) => strategy.run());
  const keys: string[] = reader.getKeys();
  void keys;
  deleter.delete('claude');

  // @ts-expect-error a factory must build the registry's item type
  writer.set('wrong', () => 42);

  // @ts-expect-error CanSet takes a factory, not the item itself
  writer.set('eager', { run: () => 'e' });

  // @ts-expect-error get answers a promise of the item
  const eager: Strategy = reader.get('claude');
  void eager;

  // @ts-expect-error a registry of one item type is not a reader of another
  const numbers: CanGet<number> = registry;
  void numbers;
}
