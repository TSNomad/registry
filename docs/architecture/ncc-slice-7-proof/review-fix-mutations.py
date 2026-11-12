# Slice 7 review fix proof: the run starts one microtask after `get`
# stores it, so a factory that gets its own key synchronously waits on
# its own run. Each entry is (id, file, find, replace, expect). The first
# three are the harness controls. Run with:
#   python3 docs/architecture/ncc-slice-7-proof/mutate.py . docs/architecture/ncc-slice-7-proof/review-fix-mutations.py
R = 'src/Registry.ts'
START = "    return Promise.resolve().then(() => entry.factory()).then("
MUTATIONS = [
  ('C1-must-catch: get answers undefined', R, "    return entry.pending;\n  }", "    return undefined as T;\n  }", 'killed'),
  ('C2-must-survive: comment only', R, START, "    // harmless\n" + START, 'survive'),
  ('C3-must-refuse: syntax break', R, START, START + "(", 'refuse'),

  ('F1 the factory starts before get stores the run, as at 909fcaf', R, START, "    return (async () => entry.factory())().then(", 'killed'),
]
