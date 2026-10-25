# Spec: slugify

## Goal
A slugify function for URL-safe slugs.

## Non-goals
- Anything not listed in the acceptance criteria.

## Acceptance criteria
- AC-1. slugify(text) lowercases the text and separates words with single hyphens.
- AC-2. Accents are removed: slugify('Crème Brûlée') is 'creme-brulee'.
- AC-3. Runs of spaces, underscores or punctuation collapse to one hyphen, and no slug starts or ends with a hyphen.
- AC-4. slugify('') and slugify('!!!') return the empty string.

## Constraints
- Node built-ins only. CommonJS modules.

## Open questions
- None.
