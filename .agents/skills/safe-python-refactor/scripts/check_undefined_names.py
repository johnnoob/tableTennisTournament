"""Static undefined-name and syntax checker for Python files using stdlib AST.

Designed to catch accidental helper deletions or missing imports that pass
`python -m py_compile` (syntax-only) yet fail at runtime with `NameError`.
Uses only the Python standard library so it runs without project venv deps.
"""

from __future__ import annotations

import ast
import builtins
import pathlib
import sys


BUILTIN_NAMES: set[str] = set(dir(builtins)) | {
    "__annotations__",
    "__doc__",
    "__file__",
    "__name__",
    "__package__",
}

IGNORED_DIRS: set[str] = {"__pycache__", ".venv", "venv", "node_modules", ".git"}


def _iter_python_files(targets: list[str]) -> list[pathlib.Path]:
    roots = [pathlib.Path(t) for t in (targets or ["backend"])]
    files: list[pathlib.Path] = []
    for root in roots:
        if root.is_file():
            if root.suffix == ".py":
                files.append(root)
            continue
        if root.is_dir():
            for path in sorted(root.rglob("*.py")):
                if any(part in IGNORED_DIRS for part in path.parts):
                    continue
                files.append(path)
    return files


def _collect_defined_names(tree: ast.AST) -> set[str]:
    defined = set(BUILTIN_NAMES)
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            defined.add(node.name)
            for arg in node.args.posonlyargs + node.args.args + node.args.kwonlyargs:
                defined.add(arg.arg)
            if node.args.vararg:
                defined.add(node.args.vararg.arg)
            if node.args.kwarg:
                defined.add(node.args.kwarg.arg)
        elif isinstance(node, ast.Lambda):
            for arg in node.args.posonlyargs + node.args.args + node.args.kwonlyargs:
                defined.add(arg.arg)
            if node.args.vararg:
                defined.add(node.args.vararg.arg)
            if node.args.kwarg:
                defined.add(node.args.kwarg.arg)
        elif isinstance(node, ast.ClassDef):
            defined.add(node.name)
        elif isinstance(node, ast.Import):
            for alias in node.names:
                defined.add(alias.asname or alias.name.split(".")[0])
        elif isinstance(node, ast.ImportFrom):
            for alias in node.names:
                defined.add(alias.asname or alias.name)
        elif isinstance(node, ast.Name) and isinstance(node.ctx, ast.Store):
            defined.add(node.id)
        elif isinstance(node, ast.ExceptHandler) and node.name:
            defined.add(node.name)
        elif isinstance(node, ast.comprehension):
            for inner in ast.walk(node.target):
                if isinstance(inner, ast.Name):
                    defined.add(inner.id)
        elif hasattr(ast, "MatchAs") and isinstance(node, ast.MatchAs) and node.name:
            defined.add(node.name)
    return defined


def check_file(path: pathlib.Path) -> list[str]:
    issues: list[str] = []
    try:
        source = path.read_text(encoding="utf-8")
        tree = ast.parse(source, filename=str(path))
    except SyntaxError as exc:
        return [f"{path}:{exc.lineno}: SyntaxError: {exc.msg}"]

    defined = _collect_defined_names(tree)
    missing: set[tuple[int, str]] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Name) and isinstance(node.ctx, ast.Load):
            if node.id not in defined:
                missing.add((node.lineno, node.id))

    for lineno, name in sorted(missing):
        issues.append(f"{path}:{lineno}: undefined name '{name}'")
    return issues


def main(argv: list[str]) -> int:
    files = _iter_python_files(argv[1:])
    if not files:
        print("ERROR: no Python files found to check.", file=sys.stderr)
        return 1

    all_issues: list[str] = []
    for path in files:
        all_issues.extend(check_file(path))

    if all_issues:
        for line in all_issues:
            print(line, file=sys.stderr)
        return 1

    print(f"OK: scanned {len(files)} Python files, 0 undefined names.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
