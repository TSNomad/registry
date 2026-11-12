/**
 * @tsnomad/registry
 *
 * Public entry point. Re-exports the registry class, the PHPNomad
 * registry interfaces it implements, and its supporting types so
 * consumers can import everything from the package root.
 */

export { Registry } from './Registry.js';
export type { ItemFactory, ItemMetadata } from './types.js';
export type { CanGet } from './CanGet.js';
export type { CanSet } from './CanSet.js';
export type { CanDelete } from './CanDelete.js';
export { RegistryError, KeyNotFoundError, DuplicateKeyError } from './errors.js';
