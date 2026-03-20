from __future__ import annotations

"""
ai_modules package – bridge to the shared NIROGI AI code.

This ensures the project root (which contains the standalone `nirogi_ai`
package) is on sys.path so we can import it from the Backend app.
"""

from pathlib import Path
import sys

# This file lives at .../doc/Backend/app/ai_modules/__init__.py
# The project root (which contains `nirogi_ai`) is three levels up from Backend:
#   __file__ -> ai_modules -> app -> Backend -> doc
ROOT = Path(__file__).resolve().parents[3]  # .../doc
root_str = str(ROOT)
if root_str not in sys.path:
    sys.path.insert(0, root_str)

