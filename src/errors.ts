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
