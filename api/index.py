import sys
from pathlib import Path

BACKEND_DIR = str(Path(__file__).resolve().parent.parent / "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from main import app  # noqa: E402, F401
