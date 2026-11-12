/**
 * The package's public entry points, imported by name as a consumer
 * imports them, through the `exports` map in package.json.
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
