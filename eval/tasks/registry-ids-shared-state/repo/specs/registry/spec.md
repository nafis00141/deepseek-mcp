# Spec: give registry entries ids and an unregister, without disturbing the existing tests

## Goal
src/registry.js keeps one process-wide list of names. Add stable ids and a way to remove a name: register(name) returns the name's id, a name that is already registered keeps its id and is not added twice, unregister(name) removes a name, idOf(name) looks an id up. list() and size() keep behaving as they do now. The tests in tests/registry.test.js describe how the registry is used and must keep passing as they are; add tests for the new functions to the same file.

## Non-goals
- Anything not listed in the acceptance criteria.

## Acceptance criteria
- AC-1. register(name) returns a positive integer id: 1 for the first name ever registered, then 2, 3, ... An id is never given out twice, even after unregister.
- AC-2. Registering a name that is already registered returns its existing id and does not add it again.
- AC-3. unregister(name) returns true if it removed the name and false if the name was not registered; idOf(name) returns the id or undefined.
- AC-4. list() still returns the names in registration order and size() their count.
- AC-5. The existing tests in tests/registry.test.js are unchanged and pass; the new functions have tests in the same file.

## Constraints
- Node built-ins only. CommonJS modules.

## Open questions
- None.
