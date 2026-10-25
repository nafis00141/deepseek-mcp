# Spec: slug utility

## Goal
A slug function and a CLI around it.

## Non-goals
- Anything not listed in the acceptance criteria.

## Acceptance criteria
- AC-1. slug(text) lowercases text and joins words with hyphens (src/lib/slug.js).
- AC-2. The CLI in bin/cli.js prints slug(argv[2]).
- AC-3. docs/usage.md explains the CLI.

## Constraints
- Node built-ins only. CommonJS modules.

## Open questions
- None.
