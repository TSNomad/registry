/**
 * @tsnomad/registry
 *
 * Public entry point. Re-exports the registry class and its supporting
 * types so consumers can import everything from the package root.
 */

export { Registry } from './Registry.js';
export type { ItemFactory, ItemMetadata } from './types.js';
export { RegistryError, KeyNotFoundError, DuplicateKeyError } from './errors.js';
