/**
 * Acceptance tests: the Registry through PHPNomad's `CanGet`, `CanSet`
 * and `CanDelete`, and the 0.1 behavior every consumer relies on.
 *
 * Packet P2 implemented these and removed their `skip`, so every test
 * here runs. The tests that passed on the 0.1 code ran from the start.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Registry } from '../dist/Registry.js';
import { DuplicateKeyError } from '../dist/errors.js';
import type { CanDelete, CanGet, CanSet } from '../dist/index.js';

test('a value set through CanSet is read back through CanGet', async () => {
  const registry = new Registry<string>();
  const writer: CanSet<string> = registry;
  const reader: CanGet<string> = registry;
  writer.set('claude', () => 'c');
  writer.set('codex', async () => 'x');

  assert.equal(await reader.get('claude'), 'c');
  assert.deepEqual(await reader.getAll(), ['c', 'x']);
});

test('getKeys lists every key in the order it was set, as keys() does', () => {
  const registry = new Registry<string>();
  const reader: CanGet<string> = registry;
  assert.deepEqual(reader.getKeys(), []);
  registry.set('b', () => 'b');
  registry.set('a', () => 'a');
  registry.replace('c', () => 'c');

  assert.deepEqual(reader.getKeys(), ['b', 'a', 'c']);
  assert.deepEqual(reader.getKeys(), registry.keys());

  registry.delete('b');
  assert.deepEqual(reader.getKeys(), ['a', 'c']);
});

test('CanDelete removes the item, and deleting a missing id does nothing', async () => {
  const registry = new Registry<string>();
  const deleter: CanDelete = registry;
  registry.set('claude', () => 'c');

  deleter.delete('claude');
  deleter.delete('never-set');

  assert.equal(registry.has('claude'), false);
  assert.equal(registry.size, 0);
});

test('setting a key twice throws DuplicateKeyError, and replace replaces on purpose', async () => {
  const registry = new Registry<string>();
  registry.set('claude', () => 'first');

  assert.throws(() => registry.set('claude', () => 'second'), (error: unknown) => error instanceof DuplicateKeyError && error.key === 'claude');
  assert.equal(await registry.get('claude'), 'first');

  registry.replace('claude', () => 'replaced');
  assert.equal(await registry.get('claude'), 'replaced');
});

test('metadata, tags and priority stay as 0.1 has them', () => {
  const registry = new Registry<string>();
  registry.set('a', () => 'a', { priority: 1, tags: ['fast'] });
  registry.set('b', () => 'b', { priority: 5 });
  registry.set('c', () => 'c', { tags: ['fast'] });

  assert.deepEqual(registry.findByTag('fast'), ['a', 'c']);
  assert.deepEqual(registry.keysByPriority(), ['b', 'a', 'c']);
  assert.deepEqual(registry.getMetadata('b'), { priority: 5 });
});

test('getAllEntries answers the record keyed by id, as PHPNomad getAll does', async () => {
  const registry = new Registry<string>();
  registry.set('a', () => 'A');
  registry.set('b', () => 'B');
  assert.deepEqual(await registry.getAllEntries(), { a: 'A', b: 'B' });
});
