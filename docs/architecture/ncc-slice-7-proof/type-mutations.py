# One loosening per @ts-expect-error directive in test/registry-type-safety.ts,
# plus three controls. Scored by types-mutate.py.
G = 'src/CanGet.ts'
S = 'src/CanSet.ts'
DEL = "export interface CanDelete {\n  delete(id: string): void;\n}"
MUTATIONS = [
  ('TC1-must-catch: factories build anything', S, "  set(id: string, factory: ItemFactory<T>): void;", "  set(id: string, factory: ItemFactory<unknown>): void;", ["a factory must build the registry's item type"]),
  ('TC2-must-survive: comment only', 'src/CanDelete.ts', DEL, "// harmless\n" + DEL, 'survive'),
  ('TC3-must-refuse: syntax break', 'src/CanDelete.ts', DEL, DEL + "(", 'refuse'),
  ('TS1 set takes the item itself', S, "  set(id: string, factory: ItemFactory<T>): void;", "  set(id: string, factory: ItemFactory<T> | T): void;", ['CanSet takes a factory']),
  ('TG1 get answers anything', G, "  get(id: string): Promise<T>;", "  get(id: string): any;", ['get answers a promise']),
  ('TG2 CanGet ignores its item type', G, [("  get(id: string): Promise<T>;", "  get(id: string): Promise<any>;"), ("  getAll(): Promise<T[]>;", "  getAll(): Promise<any[]>;")], None, ['a registry of one item type']),
]
