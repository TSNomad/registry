/**
 * TSNomad Registry
 *
 * Generic registry for managing collections with lazy loading.
 * Items are set as factories and only instantiated when first accessed.
 *
 * Usage:
 * ```typescript
 * const strategies = new Registry<AiStrategy>();
 *
 * strategies.set('claude', () => new ClaudeStrategy());
 * strategies.set('aider', () => new AiderStrategy(), { priority: 10 });
 *
 * const claude = await strategies.get('claude');
 * const all = await strategies.getAll();
 * ```
 */

import type { ItemFactory, ItemMetadata } from './types.js';
import type { CanGet } from './CanGet.js';
import type { CanSet } from './CanSet.js';
import type { CanDelete } from './CanDelete.js';
import { KeyNotFoundError, DuplicateKeyError } from './errors.js';

/**
 * Internal entry stored in the registry.
 */
interface RegistryEntry<T> {
  factory: ItemFactory<T>;
  instance: T | null;
  metadata: ItemMetadata;
  /**
   * True once the factory has answered. The answer may be null or
   * undefined, so `instance` alone cannot tell a built entry apart.
   */
  built?: boolean;
  /**
   * The factory run in flight, shared by every get that arrives before
   * it settles. Cleared when the run settles.
   */
  pending?: Promise<T>;
}

/**
 * Generic registry with lazy loading support, implementing PHPNomad's
 * `CanGet`, `CanSet` and `CanDelete`. Metadata, tags and priority are
 * TS Nomad additions.
 */
export class Registry<T> implements CanGet<T>, CanSet<T>, CanDelete {
  /**
   * Registered entries keyed by name.
   */
  private entries = new Map<string, RegistryEntry<T>>();

  /**
   * Sets an item factory in the registry.
   * The item is not instantiated until first access.
   *
   * @param key - Unique identifier for this item
   * @param factory - Function that creates the item
   * @param metadata - Optional metadata for filtering/sorting
   * @throws DuplicateKeyError if key is already set
   */
  set(
    key: string,
    factory: ItemFactory<T>,
    metadata: ItemMetadata = {}
  ): void {
    if (this.entries.has(key)) {
      throw new DuplicateKeyError(key);
    }

    this.entries.set(key, {
      factory,
      instance: null,
      metadata,
    });
  }

  /**
   * Replaces an existing entry.
   * Clears any cached instance.
   *
   * @param key - Unique identifier for this item
   * @param factory - Function that creates the item
   * @param metadata - Optional metadata for filtering/sorting
   */
  replace(
    key: string,
    factory: ItemFactory<T>,
    metadata: ItemMetadata = {}
  ): void {
    this.entries.set(key, {
      factory,
      instance: null,
      metadata,
    });
  }

  /**
   * Gets an item by key, building it from its factory the first time.
   *
   * - The factory runs once per entry. Concurrent first gets of one key
   *   share that one run and receive the same item.
   * - Whatever the factory answers is the item, null and undefined
   *   included, and later gets serve it without running the factory
   *   again, as PHPNomad's registry marks an id initialized.
   * - A factory that throws or rejects caches nothing. Every get waiting
   *   on that run rejects with its error, and the next get runs the
   *   factory again from the start. The registry never retries a
   *   factory on its own. A caller that wants a retry limit or a
   *   backoff owns that policy.
   * - A run belongs to the entry that started it. When `replace`,
   *   `delete` or `clear` removes that entry while the run is in
   *   flight, its result is never stored on a later entry under the
   *   same key, and a get after the removal runs the new entry's factory.
   * - A factory must not get its own key, directly or through another
   *   key's factory. That get waits on its own run and never settles.
   *
   * Each entry object keeps its own run and its own built flag.
   * `set` and `replace` store a new entry object, and `delete` and
   * `clear` drop the old one, so a run in flight writes only to the
   * entry that started it.
   *
   * @param key - The item key
   * @returns Promise resolving to the item
   * @throws KeyNotFoundError if key is not set
   */
  async get(key: string): Promise<T> {
    const entry = this.entries.get(key);

    if (!entry) {
      throw new KeyNotFoundError(key, this.keys());
    }

    if (entry.built) {
      return entry.instance as T;
    }

    if (!entry.pending) {
      entry.pending = this.build(entry);
    }

    return entry.pending;
  }

  /**
   * Runs an entry's factory once and settles the entry from the result.
   * A success stores the item and marks the entry built. A failure
   * stores nothing and clears the run, so the next get starts a new one.
   * A factory that throws synchronously rejects like one that rejects.
   *
   * @param entry - The entry that owns this run
   * @returns Promise resolving to the item
   */
  private build(entry: RegistryEntry<T>): Promise<T> {
    return (async () => entry.factory())().then(
      (item) => {
        entry.instance = item;
        entry.built = true;
        entry.pending = undefined;
        return item;
      },
      (error: unknown) => {
        entry.pending = undefined;
        throw error;
      }
    );
  }

  /**
   * Checks if a key is set.
   *
   * @param key - The key to check
   * @returns True if set
   */
  has(key: string): boolean {
    return this.entries.has(key);
  }

  /**
   * Gets all set keys.
   *
   * @returns Array of key strings
   */
  keys(): string[] {
    return Array.from(this.entries.keys());
  }

  /**
   * Gets every key, in the order they were set. PHPNomad's name for
   * `keys()`.
   *
   * @returns Array of key strings
   */
  getKeys(): string[] {
    return this.keys();
  }

  /**
   * Gets metadata for a key without instantiating.
   *
   * @param key - The key to look up
   * @returns Metadata or undefined if not set
   */
  getMetadata(key: string): ItemMetadata | undefined {
    return this.entries.get(key)?.metadata;
  }

  /**
   * Gets every item, in the order the keys were set, building any that
   * have not been built.
   *
   * It reads the keys set when it starts, and gets them one at a time,
   * in that order, through `get`, so it shares runs with gets in flight.
   * It rejects with the error of the first key that fails. A key
   * deleted before its turn rejects with `KeyNotFoundError`.
   *
   * @returns Promise resolving to array of all items
   */
  async getAll(): Promise<T[]> {
    const items: T[] = [];

    for (const key of this.keys()) {
      items.push(await this.get(key));
    }

    return items;
  }

  /**
   * Gets every item as a record keyed by id, as PHPNomad's `getAll`
   * does. It reads and fails as `getAll` does.
   *
   * @returns Promise resolving to Record of key to item
   */
  async getAllEntries(): Promise<Record<string, T>> {
    const result: Record<string, T> = {};

    for (const key of this.keys()) {
      result[key] = await this.get(key);
    }

    return result;
  }

  /**
   * Finds keys matching a metadata filter.
   *
   * @param filter - Function that returns true for matching metadata
   * @returns Array of matching keys
   */
  findByMetadata(filter: (meta: ItemMetadata) => boolean): string[] {
    const matches: string[] = [];

    for (const [key, entry] of this.entries) {
      if (filter(entry.metadata)) {
        matches.push(key);
      }
    }

    return matches;
  }

  /**
   * Finds keys by tag.
   *
   * @param tag - Tag to search for
   * @returns Array of keys that have this tag
   */
  findByTag(tag: string): string[] {
    return this.findByMetadata((meta) => meta.tags?.includes(tag) ?? false);
  }

  /**
   * Gets keys sorted by priority (highest first).
   *
   * @returns Array of keys sorted by priority
   */
  keysByPriority(): string[] {
    const entries = Array.from(this.entries.entries());

    entries.sort((a, b) => {
      const priorityA = a[1].metadata.priority ?? 0;
      const priorityB = b[1].metadata.priority ?? 0;
      return priorityB - priorityA;
    });

    return entries.map(([key]) => key);
  }

  /**
   * Deletes an entry and its cached instance.
   *
   * @param key - The key to delete
   */
  delete(key: string): void {
    this.entries.delete(key);
  }

  /**
   * Clears all entries and instances.
   */
  clear(): void {
    this.entries.clear();
  }

  /**
   * Gets the number of set items.
   */
  get size(): number {
    return this.entries.size;
  }
}
