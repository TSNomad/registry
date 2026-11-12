/**
 * The package's public entry points, imported by name as a consumer
 * imports them, through the `exports` map in package.json.
 *
 * The second test carries `skip` until packet P5 adds
 * `ReentrantGetError`.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as registry from '@tsnomad/registry';
import { Registry } from '@tsnomad/registry/registry';
import { KeyNotFoundError } from '@tsnomad/registry/errors';
import type { CanGet } from '@tsnomad/registry/can-get';

test('the package root exports the registry and its errors', () => {
  for (const name of ['Registry', 'RegistryError', 'KeyNotFoundError', 'DuplicateKeyError']) {
    assert.ok(name in registry, `${name} is not exported`);
  }
  assert.equal(registry.Registry, Registry);
  assert.equal(registry.KeyNotFoundError, KeyNotFoundError);
  const reader: CanGet<string> = new Registry<string>();
  assert.deepEqual(reader.getKeys(), []);
});

test('the package root and the errors entry export ReentrantGetError, a RegistryError', async () => {
  const errors = await import('@tsnomad/registry/errors');
  assert.ok('ReentrantGetError' in registry, 'ReentrantGetError is not exported from the root');
  assert.ok('ReentrantGetError' in errors, 'ReentrantGetError is not exported from the errors entry');
  const ReentrantGetError = (registry as Record<string, unknown>).ReentrantGetError as { prototype: unknown };
  assert.equal(ReentrantGetError, (errors as Record<string, unknown>).ReentrantGetError);
  assert.ok(ReentrantGetError.prototype instanceof registry.RegistryError);
});
