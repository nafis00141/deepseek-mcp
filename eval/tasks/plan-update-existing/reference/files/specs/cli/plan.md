# Plan

## Approach
Wrap slug in a thin command line entry point, and keep all parsing in one place.

## Touch points
- src/cli.js (new): reads argv[2], prints the slug, exits 1 without an argument
- src/lib/slug.js: the existing slug function

## Data and API changes
None.

## Test strategy
Spawn the CLI in a test and compare its output.

## Risks
- The shebang line is ignored on some platforms.
- Windows path separators: build any file path with node:path, never by string concatenation.

## Task breakdown rationale
One task: the CLI is small.
