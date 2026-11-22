---
name: safe-python-refactor
description: >-
  Mandatory checklist and static verification guardrails whenever editing, refactoring,
  or extracting helpers/constants in `backend/**/*.py`, or before committing/pushing
  backend changes. Prevents accidentally deleting neighboring helper functions or
  leaving broken references that `py_compile` cannot catch (NameError -> HTTP 500).
---

# Safe Python Refactor & Symbol Verification

Use this workflow whenever modifying Python modules under `backend/` (especially
when extracting shared helpers/constants across files or editing large routers).

## Why This Exists (Incident Postmortem)

During commit `6130573`, `COOKIE_SAMESITE` and `COOKIE_SECURE` were extracted from
`backend/routers/auth.py` into `backend/services/auth_jwt.py`. Neighboring helper
functions `_sanitize_next_path` and `_build_frontend_redirect` were included in the
`edit_file` removal block and accidentally deleted. Because `python -m py_compile`
only checks syntax (not symbol resolution), the issue slipped into production and
caused `500 Internal Server Error` (`NameError`) on Google and LINE OAuth logins
and account linking.

## Mandatory Steps

1. **Minimal Edit Targets**
   - When extracting constants or functions across files, keep `edit_file` `Target`
     and `Replacement` strictly scoped to the exact lines being moved.
   - Never span a single removal `Target` across unrelated neighboring `def` or
     `async def` blocks.

2. **Audit Every Deleted Function or Class**
   - After editing `backend/**/*.py`, inspect removed definitions with:
     `git diff -U0 -- backend`
   - For every removed `-def `, `-async def `, or `-class `, run:
     `git grep -n "<symbol_name>" backend`
   - Confirm zero remaining call sites before moving on.

3. **Never Rely on `py_compile` Alone**
   - Always run **both** syntax compilation and the zero-dependency AST undefined-name
     scanner ([check_undefined_names.py](./scripts/check_undefined_names.py)) after
     your final backend edit and before any `git commit` / `git push`:
     - `C:\Users\s0790\AppData\Local\Python\bin\python.exe -m py_compile <modified files>`
     - `C:\Users\s0790\AppData\Local\Python\bin\python.exe .agents/skills/safe-python-refactor/scripts/check_undefined_names.py backend`
   - Verification passes only when exit code is `0` and output reports
     `OK: scanned <N> Python files, 0 undefined names.`.
