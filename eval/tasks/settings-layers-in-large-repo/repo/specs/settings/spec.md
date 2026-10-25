# Spec: settings layers: lists must replace, and an empty environment variable must not wipe a value

## Goal
The settings resolver layers three sources: defaults, then the config file, then environment variables, later ones winning. Two things go wrong: a list in the file config is appended to the default list instead of replacing it (defaults tags ['a', 'b'] plus file tags ['c'] gives ['a', 'b', 'c']), and an environment variable that is set but empty (APP_SERVER__PORT=) overwrites the value with 0, [] or ''. Fix both. The older loader kept for archived configs appends lists on purpose and must not change.

## Non-goals
- Anything not listed in the acceptance criteria.

## Acceptance criteria
- AC-1. A list from a higher layer replaces the list below it, at any depth of nesting.
- AC-2. An environment variable whose value is empty is ignored.
- AC-3. Objects still merge key by key, undefined is ignored, and null still clears a value.
- AC-4. Environment variables keep working as they do: APP_ prefix, __ for nesting, converted to the type of the default.
- AC-5. The archived-config loader behaves exactly as before.

## Constraints
- Node built-ins only. CommonJS modules.

## Open questions
- None.
