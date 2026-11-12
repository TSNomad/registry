/**
 * Unit tests for the registry's private run, `Registry.build`, beyond
 * what the acceptance tests pin. Written by packet P2. The slice 7
 * review added the second test: a factory that gets its own key
 * synchronously must wait on its own run, not start another one.
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

test('a factory that gets its own key synchronously runs once, and that get waits on its own run', async () => {
  const registry = new Registry<string>();
  let runs = 0;
  let settled = false;
  registry.set('self', () => {
    runs += 1;
    // The stop only ends the loop a second run would start.
    if (runs > 3) {
      return 'stopped';
    }
    return registry.get('self');
  });

  registry.get('self').then(
    () => { settled = true; },
    () => { settled = true; }
  );
  for (let turn = 0; turn < 5; turn++) {
    await new Promise((resolve) => setImmediate(resolve));
  }

  assert.equal(runs, 1);
  assert.equal(settled, false);
});
