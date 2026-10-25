---
id: 01
allowed_paths: [src/**, tests/**]
test_command: node --test tests/winpaths.test.js
depends_on: []
---

# Task 01 - Windows path helpers: same file, same folder, manifest files
## Goal
Implement the four helpers in src/winpaths.js. They describe Windows paths and files and must give the same answers on any host OS, because CI runs on Linux too. Windows rules apply: case does not matter, / and \ are the same separator, and files written on Windows have CRLF line endings.

## Acceptance criteria
- AC-1: samePath(a, b) is true when a and b name the same file or folder on Windows.
- AC-2: dedupePaths(list) drops every path that names the same file as an earlier one, keeps the first spelling and the original order.
- AC-3: isInside(root, p) is true when p is root itself or lies below it, and false for a sibling whose name merely starts with root's name, for another drive, and for a path that climbs out with '..'.
- AC-4: readManifest(text) returns the paths listed in a manifest file: one per line, blank lines and lines starting with # skipped, surrounding spaces removed, whatever the line endings or a leading byte order mark.

## Out of scope
- Touching the real file system.
