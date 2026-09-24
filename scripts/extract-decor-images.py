#!/usr/bin/env python3
"""Crop product photos from the flattened Decor Pulls Mortise PDF via OCR labels."""

from __future__ import annotations

import gzip
import json
import re
from pathlib import Path

import pymupdf
import pytesseract
from PIL import Image
from pytesseract import Output

ROOT = Path(__file__).resolve().parents[1]
PDF = ROOT / "catalog_pdfs" / "decor-pulls-mortise-price-list.pdf"
SEED = ROOT / "data" / "catalog-seed.json.gz"
OUT_DIR = ROOT / "public" / "catalog" / "decor"
CODES_JSON = ROOT / "src" / "lib" / "catalog" / "decor-image-keys.json"
ZOOM = 3.2
SKIP_PAGES = {0, 1, 19}

DM_RE = re.compile(r"\bD\s*M\s*([0-9OIL]{3})\b")
DKB_RE = re.compile(r"\bDKB\s*([0-9OIL]{3})\b")
DC_RE = re.compile(r"\bDC\s*[0O]*\s*([1-7IL])\s*[-–]?\s*([0-9OIL]{3})")
CH_RE = re.compile(r"\bCH\s*[0O]*\s*([1-9IL])\s*[-–]?\s*([0-9OIL]{3})")
DCH_RE = re.compile(r"\bDCH\s*[0O]*\s*([1-4IL])")
WH_RE = re.compile(r"\bWH\s*([0-9OIL]{3})\b")
MISC = [
    ("OSKK", re.compile(r"\bO[S5]KK\b")),
    ("OSKC", re.compile(r"\bOSKC\b")),
    ("BSK", re.compile(r"\bBSK\b")),
    ("HCK", re.compile(r"\bHCK\b")),
    ("HC", re.compile(r"\bHC\b")),
    ("LB3", re.compile(r"\bLB3\b")),
    ("LB4", re.compile(r"\bLB4\b")),
    ("LBR", re.compile(r"\bLBR\b")),
    ("LB", re.compile(r"\bLB\b")),
    ("BLH", re.compile(r"\bBLH\b")),
    ("CYBIG", re.compile(r"\bCYBIG\b")),
    ("CYSML", re.compile(r"\bCYSML\b")),
    ("KBSC", re.compile(r"\bKBSC\b")),
    ("SQBSC", re.compile(r"\bSQBSC\b")),
    ("RBSC", re.compile(r"\bRBSC\b")),
    ("ZBSC", re.compile(r"\bZBSC\b")),
    ("DL", re.compile(r"\bDL\b")),
]


def digits(raw: str) -> str:
    return "".join({"O": "0", "I": "1", "L": "1"}.get(ch, ch) for ch in raw)


def seed_codes() -> list[str]:
    data = json.loads(gzip.decompress(SEED.read_bytes()))
    return sorted({p["code"] for p in data["products"] if p["catalog_id"] == 1})


def decor_family(code: str) -> str | None:
    c = code.upper().strip()
    match = re.match(r"^DM\s+(\d{3})", c)
    if match:
        return f"DM-{match.group(1)}"
    match = re.match(r"^DKB\s+(\d{3})", c)
    if match:
        return f"DKB-{match.group(1)}"
    match = re.match(r"^DCH0(\d)", c)
    if match:
        return f"DCH0{match.group(1)}"
    match = re.match(r"^DC0(\d)", c)
    if match:
        return f"DC0{match.group(1)}"
    match = re.match(r"^CH0(\d)", c)
    if match:
        return f"CH0{match.group(1)}"
    match = re.match(r"^WH\s+(\d{3})", c)
    if match:
        return f"WH-{match.group(1)}"
    for fam in (
        "OSKK",
        "OSKC",
        "BSK",
        "HCK",
        "CYBIG",
        "CYSML",
        "KBSC",
        "SQBSC",
        "RBSC",
        "ZBSC",
        "LB3",
        "LB4",
        "LBR",
        "BLH",
        "HC",
        "LB",
        "DL",
    ):
        if c == fam or c.startswith(fam + " "):
            return fam
    return None


def page_image(page: pymupdf.Page) -> Image.Image:
    pix = page.get_pixmap(matrix=pymupdf.Matrix(ZOOM, ZOOM), alpha=False)
    return Image.frombytes("RGB", (pix.width, pix.height), pix.samples)


def ocr_lines(img: Image.Image) -> list[tuple[str, int, int, int, int]]:
    data = pytesseract.image_to_data(img, output_type=Output.DICT)
    words: list[tuple[str, int, int, int, int]] = []
    for text, x, y, w, h in zip(data["text"], data["left"], data["top"], data["width"], data["height"]):
        text = text.strip()
        if text:
            words.append((text, x, y, w, h))
    words.sort(key=lambda item: (item[2], item[1]))
    lines: list[list[tuple[str, int, int, int, int]]] = []
    for word in words:
        if lines and abs(word[2] - lines[-1][0][2]) <= 16:
            lines[-1].append(word)
        else:
            lines.append([word])
    out: list[tuple[str, int, int, int, int]] = []
    for group in lines:
        group = sorted(group, key=lambda item: item[1])
        text = " ".join(item[0] for item in group)
        x0 = min(item[1] for item in group)
        y0 = min(item[2] for item in group)
        x1 = max(item[1] + item[3] for item in group)
        y1 = max(item[2] + item[4] for item in group)
        out.append((text, x0, y0, x1, y1))
    return out


def keys_on_page(lines: list[tuple[str, int, int, int, int]]) -> list[tuple[str, int]]:
    found: list[tuple[str, int]] = []
    seen: set[str] = set()
    for text, _x0, y0, _x1, _y1 in lines:
        upper = re.sub(r"[^A-Z0-9 -]", " ", text.upper())
        hits: list[str] = []
        for match in DM_RE.finditer(upper):
            hits.append(f"DM-{digits(match.group(1))}")
        for match in DKB_RE.finditer(upper):
            hits.append(f"DKB-{digits(match.group(1))}")
        for match in DCH_RE.finditer(upper):
            hits.append(f"DCH0{digits(match.group(1))}")
        for match in DC_RE.finditer(upper):
            hits.append(f"DC0{digits(match.group(1))}")
        for match in CH_RE.finditer(upper):
            hits.append(f"CH0{digits(match.group(1))}")
        for match in WH_RE.finditer(upper):
            hits.append(f"WH-{digits(match.group(1))}")
        for fam, pattern in MISC:
            if pattern.search(upper):
                hits.append(fam)
        for key in hits:
            if key in seen:
                continue
            seen.add(key)
            found.append((key, y0))
    found.sort(key=lambda item: item[1])
    return found


def occupied_axis(img: Image.Image, axis: str, thresh: int = 246, min_frac: float = 0.06) -> list[int]:
    pixels = img.load()
    width, height = img.size
    hits: list[int] = []
    if axis == "y":
        for y in range(height):
            dark = sum(
                1
                for x in range(0, width, 2)
                if pixels[x, y][0] < thresh or pixels[x, y][1] < thresh or pixels[x, y][2] < thresh
            )
            if dark / max(1, width // 2) >= min_frac:
                hits.append(y)
    else:
        for x in range(width):
            dark = sum(
                1
                for y in range(0, height, 2)
                if pixels[x, y][0] < thresh or pixels[x, y][1] < thresh or pixels[x, y][2] < thresh
            )
            if dark / max(1, height // 2) >= min_frac:
                hits.append(x)
    return hits


def trim(img: Image.Image, thresh: int = 246, pad: int = 6) -> Image.Image:
    rows = occupied_axis(img, "y", thresh)
    cols = occupied_axis(img, "x", thresh)
    if not rows or not cols:
        return img
    width, height = img.size
    left = max(0, cols[0] - pad)
    right = min(width, cols[-1] + pad + 1)
    top = max(0, rows[0] - pad)
    bottom = min(height, rows[-1] + pad + 1)
    return img.crop((left, top, right, bottom))


FORCED_PAGES = {
    12: [f"DKB-{i:03d}" for i in range(1, 11)],
    13: [f"DC0{i}" for i in range(1, 8)] + ["CH01"],
    14: ["DCH01", "DCH02", "DCH03", "DCH04"],
    15: [f"WH-{i:03d}" for i in range(1, 10)],
    16: ["RBSC", "SQBSC", "KBSC", "ZBSC", "CYBIG", "CYSML"],
    17: ["LB", "LB3", "LB4", "LBR", "BLH", "DL"],
    18: ["OSKK", "OSKC", "BSK", "HC", "HCK"],
}
TABLE_BOUNDS = {
    12: (0.128, 0.946),
    13: (0.155, 0.905),
    14: (0.155, 0.905),
    15: (0.128, 0.946),
    16: (0.155, 0.920),
    17: (0.155, 0.920),
    18: (0.155, 0.920),
}
SKIP_EDGES = {12, 15}
GRID_PAGES = {12}
PHOTO_RIGHT = {
    15: 0.21,
    16: 0.24,
    17: 0.235,
}
FORCED_WEIGHTS = {
    13: [4, 4, 4, 4, 4, 4, 4, 2],
    14: [5, 5, 5, 4],
    18: [7, 7, 7, 4, 4],
}


def content_bands(
    img: Image.Image, x0: int, x1: int, y0: int, y1: int, expected: int
) -> list[tuple[int, int]] | None:
    pixels = img.load()
    occupied = []
    for y in range(y0, y1):
        dark = 0
        n = 0
        for x in range(x0, x1, 2):
            r, g, b = pixels[x, y]
            n += 1
            if r < 242 or g < 242 or b < 242:
                dark += 1
        occupied.append(dark / max(1, n) > 0.12)
    raw: list[tuple[int, int]] = []
    start = None
    for i, hit in enumerate(occupied):
        if hit and start is None:
            start = y0 + i
        elif not hit and start is not None:
            raw.append((start, y0 + i))
            start = None
    if start is not None:
        raw.append((start, y1))
    merged: list[tuple[int, int]] = []
    for a, b in raw:
        if b - a < 8:
            continue
        if merged and a - merged[-1][1] < 6:
            merged[-1] = (merged[-1][0], b)
        else:
            merged.append((a, b))
    merged = [(a, b) for a, b in merged if b - a >= 24]
    if len(merged) == expected:
        return merged
    return None


def edge_bands(
    img: Image.Image, x0: int, x1: int, y0: int, y1: int, expected: int
) -> list[tuple[int, int]] | None:
    """Split stacked catalog photos on luminance jumps (works when rows abut)."""
    pixels = img.load()
    means: list[float] = []
    for y in range(y0, y1):
        total = 0
        n = 0
        for x in range(x0, x1, 3):
            r, g, b = pixels[x, y]
            total += r + g + b
            n += 1
        means.append(total / max(1, 3 * n))
    diffs = [abs(means[i] - means[i - 1]) for i in range(1, len(means))]
    peaks: list[tuple[int, float]] = []
    for i, delta in enumerate(diffs):
        if delta > 18 and (i == 0 or delta >= diffs[i - 1]) and (i == len(diffs) - 1 or delta > diffs[i + 1]):
            peaks.append((y0 + i + 1, delta))
    peaks.sort(key=lambda item: -item[1])
    min_gap = max(24, int((y1 - y0) * 0.03))
    splits: list[int] = []
    for y, _delta in peaks:
        if all(abs(y - other) > min_gap for other in splits):
            splits.append(y)
        if len(splits) >= expected - 1:
            break
    if len(splits) != expected - 1:
        return None
    splits.sort()
    bands: list[tuple[int, int]] = []
    cursor = y0
    for split in splits:
        bands.append((cursor, split))
        cursor = split
    bands.append((cursor, y1))
    return bands


def table_grid_bands(
    img: Image.Image, expected: int, y0: int, y1: int
) -> list[tuple[int, int]] | None:
    """Split on full-width table rules in the price columns."""
    width, _height = img.size
    pixels = img.load()
    x0, x1 = int(width * 0.36), int(width * 0.90)
    scores: list[float] = []
    for y in range(y0, y1):
        dark = 0
        n = 0
        for x in range(x0, x1, 2):
            r, g, b = pixels[x, y]
            n += 1
            if r + g + b < 500:
                dark += 1
        scores.append(dark / max(1, n))
    raw: list[int] = []
    for i, score in enumerate(scores):
        if score >= 0.75 and (i == 0 or score >= scores[i - 1]) and (i == len(scores) - 1 or score > scores[i + 1]):
            raw.append(y0 + i)
    min_gap = max(24, int((y1 - y0) / (expected + 1) * 0.7))
    lines: list[int] = []
    for y in raw:
        if not lines or y - lines[-1] >= min_gap:
            lines.append(y)
        elif scores[y - y0] >= scores[lines[-1] - y0]:
            lines[-1] = y
    if len(lines) < expected + 1:
        return None
    if len(lines) > expected + 1:
        lines = lines[: expected + 1]
    return [(lines[i], lines[i + 1]) for i in range(expected)]


def weighted_rows(keys: list[str], weights: list[int] | None, y0: int, y1: int) -> list[tuple[str, int, int]]:
    if not weights:
        weights = [1] * len(keys)
    total = sum(weights)
    span = y1 - y0
    rows = []
    cursor = y0
    for key, weight in zip(keys, weights):
        nxt = cursor + int(round(span * weight / total))
        rows.append((key, cursor, nxt))
        cursor = nxt
    if rows:
        rows[-1] = (rows[-1][0], rows[-1][1], y1)
    return rows


def save_crop(img: Image.Image, box: tuple[int, int, int, int], dest: Path) -> None:
    crop = img.crop(box)
    crop = trim(crop)
    if crop.width < 24 or crop.height < 24:
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    crop.save(dest, "WEBP", quality=82, method=6)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for old in OUT_DIR.glob("*.webp"):
        old.unlink()
    doc = pymupdf.open(PDF)
    cropped: dict[str, Path] = {}

    for index, page in enumerate(doc):
        if index in SKIP_PAGES:
            continue
        img = page_image(page)
        width, height = img.size
        x0 = int(width * 0.045)
        x1 = int(width * PHOTO_RIGHT.get(index, 0.29))
        top_frac, bot_frac = TABLE_BOUNDS.get(index, (0.148, 0.935))
        table_top = int(height * top_frac)
        table_bot = int(height * bot_frac)
        if index in FORCED_PAGES:
            keys = FORCED_PAGES[index]
            photo_x0, photo_x1 = int(width * 0.055), int(width * 0.20)
            detected = None
            source = "forced"
            if index in GRID_PAGES:
                detected = table_grid_bands(img, len(keys), table_top, table_bot)
                source = "grid"
            if detected is None and index not in SKIP_EDGES:
                detected = content_bands(img, photo_x0, photo_x1, table_top, table_bot, len(keys))
                source = "bands"
                if not detected:
                    detected = edge_bands(img, photo_x0, photo_x1, table_top, table_bot, len(keys))
                    source = "edges"
            if detected:
                rows = [(key, a, b) for key, (a, b) in zip(keys, detected)]
                print(f"page {index + 1}: {source} {', '.join(keys)}")
            else:
                rows = weighted_rows(keys, FORCED_WEIGHTS.get(index), table_top, table_bot)
                print(f"page {index + 1}: forced {', '.join(keys)}")
        else:
            labeled = keys_on_page(ocr_lines(img))
            if not labeled:
                print(f"page {index + 1}: no codes")
                continue
            keys = [k for k, _ in labeled]
            ys = [y for _, y in labeled]
            print(f"page {index + 1}: {', '.join(keys)}")
            rows = []
            for i, (key, y) in enumerate(labeled):
                y0 = ys[i - 1] + int(height * 0.024) if i else max(table_top, y - int(height * 0.085))
                y1 = min(height, y + int(height * 0.016))
                rows.append((key, y0, y1))
        for i, (key, y0, y1) in enumerate(rows):
            inset = max(2, int((y1 - y0) * 0.02))
            extra = int((y1 - y0) * 0.03) if index in SKIP_EDGES else 0
            y0, y1 = y0 + inset + extra, y1 - inset - extra
            if y1 - y0 < 20:
                continue
            dest = OUT_DIR / f"{key}.webp"
            save_crop(img, (x0, y0, x1, y1), dest)
            if dest.exists():
                cropped[key] = dest

    expected_keys = sorted({k for k in (decor_family(c) for c in seed_codes()) if k})
    present = sorted(k for k in expected_keys if k in cropped)
    missing = [k for k in expected_keys if k not in cropped]
    extra = sorted(k for k in cropped if k not in expected_keys)
    CODES_JSON.write_text(json.dumps(present, indent=2) + "\n")
    print(f"\ncropped {len(present)} / {len(expected_keys)} families")
    if missing:
        print("missing families:", ", ".join(missing))
    if extra:
        print("unexpected keys:", ", ".join(extra))
    codes = seed_codes()
    uncovered = [c for c in codes if decor_family(c) not in cropped]
    print(f"SKU coverage {len(codes) - len(uncovered)} / {len(codes)}")
    if uncovered:
        print("uncovered SKUs:", ", ".join(uncovered))


if __name__ == "__main__":
    main()
