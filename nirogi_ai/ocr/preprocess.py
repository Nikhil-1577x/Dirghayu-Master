"""
preprocess.py – PDF/image loading and OpenCV preprocessing for OCR.

This module is responsible for:
  1. Loading PDF pages or image files.
  2. Converting to grayscale.
  3. Denoising and adaptive thresholding.
  4. Deskewing when necessary.
  5. Resizing to a sane DPI for Tesseract.

It does NOT perform OCR itself – that lives in `extract_text.py`.
"""

from __future__ import annotations

from pathlib import Path
from typing import List, Tuple

import cv2  # type: ignore
import numpy as np  # type: ignore

try:
    from pdf2image import convert_from_path  # type: ignore
except ImportError:  # pragma: no cover - optional dependency
    convert_from_path = None  # type: ignore


def load_pages(path: str) -> List[np.ndarray]:
    """
    Load a report file (PDF or image) and return a list of page images in BGR.

    This function does not threshold/clean the images. It is used so we can
    generate different preprocessing variants for different OCR engines.
    """
    file_path = Path(path)
    if not file_path.is_file():
        raise FileNotFoundError(f"Report not found: {path}")

    suffix = file_path.suffix.lower()
    pages_bgr: List[np.ndarray] = []

    if suffix == ".pdf":
        if convert_from_path is None:
            raise RuntimeError("pdf2image is required to process PDF reports.")
        pages = convert_from_path(str(file_path), dpi=300)
        for page in pages:
            # pdf2image returns PIL.Image – convert to OpenCV BGR
            cv_img = cv2.cvtColor(np.array(page), cv2.COLOR_RGB2BGR)
            pages_bgr.append(cv_img)
    else:
        img = cv2.imread(str(file_path), cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError(f"Failed to load image: {path}")
        pages_bgr.append(img)

    return pages_bgr


def preprocess_for_tesseract(pages_bgr: List[np.ndarray]) -> List[np.ndarray]:
    """Preprocess pages into thresholded grayscale images for Tesseract."""
    return [_preprocess_image(bgr) for bgr in pages_bgr]


def preprocess_for_paddle(pages_bgr: List[np.ndarray]) -> List[np.ndarray]:
    """
    Preprocess pages for PaddleOCR.

    PaddleOCR typically performs better on natural images than on aggressive
    adaptive-threshold binaries. We deskew + denoise and lightly boost contrast,
    but keep the image continuous-tone.
    """
    out: List[np.ndarray] = []
    for bgr in pages_bgr:
        gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
        denoised = cv2.fastNlMeansDenoising(gray, h=10)
        deskewed = _deskew(denoised)

        # Simple contrast normalization
        norm = cv2.normalize(deskewed, None, 0, 255, cv2.NORM_MINMAX)

        # Resize up small images
        h, w = norm.shape[:2]
        min_dim = 900
        if max(h, w) < min_dim:
            scale = float(min_dim) / max(h, w)
            norm = cv2.resize(
                norm,
                (int(w * scale), int(h * scale)),
                interpolation=cv2.INTER_LINEAR,
            )

        out.append(norm)
    return out


def _preprocess_image(bgr_img: np.ndarray) -> np.ndarray:
    """Apply common image-cleaning steps to improve OCR accuracy."""
    # 1) Grayscale
    gray = cv2.cvtColor(bgr_img, cv2.COLOR_BGR2GRAY)

    # 2) Denoise (fast non-local means)
    denoised = cv2.fastNlMeansDenoising(gray, h=10)

    # 3) Deskew using image moments
    deskewed = _deskew(denoised)

    # 4) Adaptive thresholding for sharper text
    thresh = cv2.adaptiveThreshold(
        deskewed,
        255,
        cv2.ADAPTIVE_THRESH_MEAN_C,
        cv2.THRESH_BINARY,
        31,
        10,
    )

    # 5) Resize if the image is very small – Tesseract prefers ~300 DPI.
    h, w = thresh.shape[:2]
    min_dim = 900
    if max(h, w) < min_dim:
        scale = float(min_dim) / max(h, w)
        thresh = cv2.resize(
            thresh,
            (int(w * scale), int(h * scale)),
            interpolation=cv2.INTER_LINEAR,
        )

    return thresh


def _deskew(image: np.ndarray) -> np.ndarray:
    """Estimate and correct skew angle using image moments."""
    coords = cv2.findNonZero(255 - image)
    if coords is None:
        return image

    rect = cv2.minAreaRect(coords)
    angle = rect[-1]

    if angle < -45:
        angle = -(90 + angle)
    else:
        angle = -angle

    if abs(angle) < 0.5:
        return image

    (h, w) = image.shape[:2]
    center = (w // 2, h // 2)
    M = cv2.getRotationMatrix2D(center, angle, 1.0)
    rotated = cv2.warpAffine(
        image,
        M,
        (w, h),
        flags=cv2.INTER_CUBIC,
        borderMode=cv2.BORDER_REPLICATE,
    )
    return rotated


__all__ = ["load_pages", "preprocess_for_tesseract", "preprocess_for_paddle"]

