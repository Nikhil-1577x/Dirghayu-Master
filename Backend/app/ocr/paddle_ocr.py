"""
paddle_ocr.py – PaddleOCR-based text extraction.

This module wraps PaddleOCR so the rest of the pipeline can call a simple
`paddle_ocr_images(images)` function, analogous to the Tesseract wrapper.
"""

from __future__ import annotations

from typing import List, Optional

import numpy as np  # type: ignore
import logging

import cv2  # type: ignore

try:
    import easyocr  # type: ignore
except ImportError:  # pragma: no cover - optional dependency
    easyocr = None  # type: ignore


_READER: Optional["easyocr.Reader"] = None  # type: ignore[name-defined]
logger = logging.getLogger(__name__)


def _get_ocr(lang: str = "en"):
    """
    Lazily initialise the OCR engine.

    If EasyOCR is not installed, this will raise at call time so that the
    caller can see a clear error message.
    """
    global _READER
    if _READER is not None:
        return _READER
    if easyocr is None:
        raise RuntimeError(
            "EasyOCR is not installed. Install it with `pip install easyocr` "
            "inside the Backend virtualenv."
        )
    # EasyOCR language codes use 'en' for English. Keep signature compatible.
    languages = ["en"] if (lang or "en").lower().startswith("en") else ["en"]
    # Disable verbose download/progress output to avoid Windows console encoding
    # issues (UnicodeEncodeError) during model download.
    _READER = easyocr.Reader(languages, gpu=False, verbose=False)
    return _READER


def paddle_ocr_images(images: List[np.ndarray], lang: str = "en") -> str:
    """
    Run OCR on a list of preprocessed images and return concatenated text.

    NOTE: The function name is kept for backward compatibility with the rest of
    the pipeline (and its existing logging), even though the underlying engine
    is EasyOCR.
    """
    if not images:
        return ""

    reader = _get_ocr(lang=lang)
    texts: list[str] = []

    for idx, img in enumerate(images):
        # Keep lightweight preprocessing; EasyOCR works well with RGB/BGR input.
        if len(img.shape) == 2:
            gray = img
        else:
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        # Otsu threshold (binary) with fallback to grayscale.
        try:
            _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        except Exception:
            binary = gray

        def _run(inp: np.ndarray) -> list[str]:
            rgb = np.stack([inp] * 3, axis=-1) if len(inp.shape) == 2 else inp
            # EasyOCR output: List[(bbox, text, confidence)]
            try:
                result = reader.readtext(rgb)
            except Exception:
                return []
            out: list[str] = []
            for item in result:
                if isinstance(item, (list, tuple)) and len(item) >= 2:
                    out.append(str(item[1]))
            return out

        # Try binary first, then grayscale if needed.
        page_texts = _run(binary)
        if not page_texts:
            logger.debug("PaddleOCR empty on page %d, retrying with grayscale.", idx)
            page_texts = _run(gray)

        if not page_texts:
            continue
        texts.extend([t for t in page_texts if t])

    return "\n".join(texts)


__all__ = ["paddle_ocr_images"]

