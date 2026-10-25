# Spec: slug command line

## Goal
A command line tool that prints the slug of its first argument.

## Non-goals
- Reading from stdin.

## Acceptance criteria
- AC-1. `slug-cli "Hello World"` prints hello-world.
- AC-2. With no argument it prints a usage line and exits with code 1.

## Constraints
- Node built-ins only.

## Open questions
- None.
