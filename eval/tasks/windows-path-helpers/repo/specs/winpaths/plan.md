# Plan

## Approach
Use node:path's win32 flavour explicitly so the result does not depend on the host.

## Touch points
- src/winpaths.js

## Data and API changes
None.

## Test strategy
Run the task's test_command; each acceptance criterion is covered by at least one assertion.

## Risks
See the task file.

## Task breakdown rationale
One task: the change is small enough to review in one sitting.
