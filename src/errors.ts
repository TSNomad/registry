/**
 * Registry Error Classes
 *
 * Specific errors for registry operations to enable targeted catch handling.
 */

/**
 * Base error for all registry-related errors.
 */
export class RegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RegistryError';
  }
}

/**
 * Thrown when attempting to get an unregistered key.
 */
export class KeyNotFoundError extends RegistryError {
  constructor(
    public readonly key: string,
    public readonly availableKeys: string[]
  ) {
    const available = availableKeys.length > 0
      ? availableKeys.join(', ')
      : 'none';
    super(`Registry key '${key}' is not registered. Available: ${available}`);
    this.name = 'KeyNotFoundError';
  }
}

/**
 * Thrown when attempting to register a key that's already registered.
 */
export class DuplicateKeyError extends RegistryError {
  constructor(public readonly key: string) {
    super(`Registry key '${key}' is already registered.`);
    this.name = 'DuplicateKeyError';
  }
}

/**
 * Thrown when a get of a key comes from inside a run of that key's own
 * factory while the run is in flight: a factory that gets its own key,
 * a cycle through other keys' factories, or a factory that replaced its
 * own key and then gets it. Such a get would otherwise wait on its own
 * run forever.
 */
export class ReentrantGetError extends RegistryError {
  constructor(
    public readonly key: string,
    /**
     * The keys of the runs in flight, from the outermost, ending with
     * the re-entrant get's key, such as ['a', 'b', 'a'].
     */
    public readonly path: readonly string[]
  ) {
    super(
      `Registry key '${key}' was got from inside its own factory run: ${path.map((step) => `'${step}'`).join(' -> ')}. ` +
        'A factory must not get its own key, directly or through other factories.'
    );
    this.name = 'ReentrantGetError';
  }
}
