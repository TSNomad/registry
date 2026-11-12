/**
 * Unit tests for the registry's private run, `Registry.build`, and the
 * re-entrant check, beyond what the acceptance tests pin. Packet P2
 * wrote the first test. Packet P5 wrote the rest: when the factory
 * starts, the run frame settling on failure, one run context per
 * registry, and the path a ReentrantGetError carries.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Registry } from '../dist/Registry.js';
import { ReentrantGetError } from '../dist/errors.js';

/** Waits until every pending promise job has run. */
const settle = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

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

test('the factory starts one microtask after get stores its run, so a get made before it starts shares the run', async () => {
  const registry = new Registry<object>();
  let runs = 0;
  registry.set('k', () => {
    runs += 1;
    return {};
  });

  const first = registry.get('k');
  assert.equal(runs, 0, 'the factory ran inside get');
  const second = registry.get('k');
  await Promise.resolve();
  assert.equal(runs, 1, 'the factory had not started one microtask later');

  assert.equal(await first, await second);
  assert.equal(runs, 1);
});

test('a run that fails is marked settled, so a get from work its factory started runs the factory again', async () => {
  const registry = new Registry<string>();
  const boom = new Error('first run fails');
  let runs = 0;
  let later: Promise<string> | undefined;
  registry.set('k', () => {
    runs += 1;
    if (runs === 1) {
      setImmediate(() => {
        later = registry.get('k');
      });
      throw boom;
    }
    return 'recovered';
  });

  await assert.rejects(registry.get('k'), (error) => error === boom);
  await settle();
  await settle();
  assert.ok(later, 'the factory\'s later work ran');
  assert.equal(await later, 'recovered');
  assert.equal(runs, 2);
});

test('a get of the same key in another registry, from inside a run, is not re-entrant', async () => {
  const outer = new Registry<string>();
  const inner = new Registry<string>();
  inner.set('k', () => 'inner');
  outer.set('k', async () => `outer+${await inner.get('k')}`);

  assert.equal(await outer.get('k'), 'outer+inner');
});

test('the path starts at the outermost run in flight and lists every run that led back to the key', async () => {
  const registry = new Registry<string>();
  registry.set('x', async () => `x+${await registry.get('a')}`);
  registry.set('a', async () => `a+${await registry.get('b')}`);
  registry.set('b', async () => `b+${await registry.get('a')}`);

  await assert.rejects(registry.get('x'), (error: unknown) => {
    assert.ok(error instanceof ReentrantGetError, String(error));
    assert.equal(error.key, 'a');
    assert.deepEqual(error.path, ['x', 'a', 'b', 'a']);
    assert.match(error.message, /'x' -> 'a' -> 'b' -> 'a'/);
    return true;
  });
});

test('a settled run in the chain drops out of the path, and the runs in flight before it still make a get re-entrant', async () => {
  const registry = new Registry<string>();
  let later: Promise<string> | undefined;
  registry.set('a', async () => {
    const b = await registry.get('b');
    // Keeps the run of 'a' in flight until the work 'b' started has run.
    await settle();
    await settle();
    return `a+${b}`;
  });
  registry.set('b', () => {
    setImmediate(() => {
      later = registry.get('a');
      later.catch(() => {});
    });
    return 'b';
  });

  assert.equal(await registry.get('a'), 'a+b');
  assert.ok(later, 'the work b started ran');
  await assert.rejects(later, (error: unknown) => {
    assert.ok(error instanceof ReentrantGetError, String(error));
    assert.equal(error.key, 'a');
    assert.deepEqual(error.path, ['a', 'a']);
    return true;
  });
});

test('a factory that deleted its own key and then gets it rejects with a ReentrantGetError, not KeyNotFoundError', async () => {
  const registry = new Registry<string>();
  registry.set('gone', async () => {
    registry.delete('gone');
    return registry.get('gone');
  });

  await assert.rejects(registry.get('gone'), (error: unknown) => {
    assert.ok(error instanceof ReentrantGetError, String(error));
    assert.deepEqual(error.path, ['gone', 'gone']);
    return true;
  });
});

test('a get from inside a run is re-entrant even when an outside get has since built the key', async () => {
  const registry = new Registry<string>();
  let resume!: () => void;
  const paused = new Promise<void>((resolve) => {
    resume = resolve;
  });
  registry.set('k', async () => {
    await paused;
    return registry.get('k');
  });

  const inside = registry.get('k');
  inside.catch(() => {});
  await settle();
  registry.replace('k', () => 'built outside');
  assert.equal(await registry.get('k'), 'built outside');
  resume();

  await assert.rejects(inside, (error: unknown) => {
    assert.ok(error instanceof ReentrantGetError, String(error));
    assert.deepEqual(error.path, ['k', 'k']);
    return true;
  });
  assert.equal(await registry.get('k'), 'built outside');
});
