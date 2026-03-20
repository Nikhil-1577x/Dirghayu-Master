"""
extract_text.py – Tesseract OCR wrapper.

Uses a single configuration:
    --oem 3  (default LSTM engine)
    --psm 6  (assume a single uniform block of text)
"""

from __future__ import annotations

from typing import List

import numpy as np  # type: ignore
import logging

try:
    import pytesseract  # type: ignore
except ImportError:  # pragma: no cover
    pytesseract = None  # type: ignore


logger = logging.getLogger(__name__)


TESSERACT_CONFIG = "--oem 3 --psm 6"


def ocr_images(images: List[np.ndarray]) -> str:
    """
    Run Tesseract OCR on a list of preprocessed images and return a single
    newline-joined string containing all pages.
    """
    if pytesseract is None:
        raise RuntimeError("pytesseract is required for OCR but is not installed.")

    texts: List[str] = []
    for idx, img in enumerate(images):
        # First pass: on the preprocessed (thresholded) image.
        txt = pytesseract.image_to_string(img, config=TESSERACT_CONFIG)
        # If OCR output is extremely short (likely failure), try again on a
        # softened grayscale version to avoid over-thresholding artefacts.
        if len(txt.strip()) < 40:
            logger.debug("Weak OCR output on page %d, retrying with grayscale.", idx)
            # Heuristic: blur slightly to reduce noise and rerun
            gray = img if len(img.shape) == 2 else np.mean(img, axis=2).astype("uint8")
            txt_retry = pytesseract.image_to_string(gray, config=TESSERACT_CONFIG)
            if len(txt_retry.strip()) > len(txt.strip()):
                txt = txt_retry
        if txt:
            texts.append(txt)
    return "\n".join(texts)


__all__ = ["ocr_images", "TESSERACT_CONFIG"]

