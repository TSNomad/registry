/**
 * Unit tests for the registry's private run, `Registry.build`, beyond
 * what the acceptance tests pin. Written by packet P2.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Registry } from '../dist/Registry.js';

test('a factory that throws synchronously rejects every concurrent get from one run, and the next get runs it again', async () => {
  const registry = new Registry<string>();
  const boom = new Error('sync failure');
  let runs = 0;
  registry.set('flaky', () => {
    runs += 1;
    if (runs === 1) {
      throw boom;
    }
    return 'recovered';
  });

  const waiting = [registry.get('flaky'), registry.get('flaky')];
  for (const get of waiting) {
    await assert.rejects(get, (error) => error === boom);
  }
  assert.equal(runs, 1);

  assert.equal(await registry.get('flaky'), 'recovered');
  assert.equal(runs, 2);
});
