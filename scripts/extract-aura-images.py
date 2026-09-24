#!/usr/bin/env python3
"""Crop Aura family photos from detected product cards (flattened PDF)."""

from __future__ import annotations

import gzip
import json
import re
import shutil
from pathlib import Path

import pymupdf
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PDF = ROOT / "catalog_pdfs" / "aura-price-list.pdf"
SEED = ROOT / "data" / "catalog-seed.json.gz"
OUT_DIR = ROOT / "public" / "catalog" / "aura"
CODES_JSON = ROOT / "src" / "lib" / "catalog" / "aura-image-keys.json"
ZOOM = 3.2

# Product cards on each 0-based page, left-to-right then top-to-bottom.
PAGE_KEYS: dict[int, list[str]] = {
    3: ["FRIDA-rose", "ZETA-rose", "VING-rose", "COLON-rose"],
    4: ["COSA-rose", "CONE-rose", "MONOC-rose", "ZARDIN-rose", "DEW-rose", "NAROW-rose"],
    5: ["PITON-rose", "SCURA-rose", "STIM-rose", "BOMMA-rose"],
    6: ["FLIP-rose", "PEBB-rose", "DROP-rose", "LENI-rose", "PYRITE-rose"],
    7: [
        "FRIDA-plate",
        "ZETA-plate",
        "VING-plate",
        "COLON-plate",
        "COSA-plate",
        "MONOC-plate",
        "DEW-plate",
        "CONE-plate",
        "ZARDIN-plate",
        "NAROW-plate",
    ],
    8: [
        "PITON-plate",
        "SCURA-plate",
        "STIM-plate",
        "BOMMA-plate",
        "FLIP-plate",
        "PEBB-plate",
        "DROP-plate",
        "LENI-plate",
        "PYRITE-plate",
    ],
    10: ["FACER", "U-FRAME", "S-FRAME", "T-FRAME"],
    11: ["SPAZY", "GRAZ", "CRUMPY", "DORON", "CROOK-SM", "GRID-SM", "SQED-SM"],
    13: ["FORNIS", "COSA-DX", "CONE-DX", "NAROW-pull", "COIL"],
    14: ["DUCT", "SKINY", "ERA", "LOCKBODY-FOUR-BULLETS", "MAGNETIC-LOCKBODY"],
}


def seed_codes() -> list[str]:
    data = json.loads(gzip.decompress(SEED.read_bytes()))
    return sorted({p["code"] for p in data["products"] if p["catalog_id"] == 5})


def aura_key(code: str) -> str | None:
    c = code.strip()
    if c.startswith("PULL HANDLE FULL PVD"):
        return None
    if c.startswith("CONE - DX"):
        return "CONE-DX"
    if c.startswith("COSA - DX"):
        return "COSA-DX"
    if c.startswith("S-FRAME"):
        return "S-FRAME"
    if c.startswith("T-FRAME"):
        return "T-FRAME"
    if c.startswith("U-FRAME"):
        return "U-FRAME"
    if c.startswith("MAGNETIC LOCKBODY"):
        return "MAGNETIC-LOCKBODY"
    if c.startswith("LOCKBODY FOUR"):
        return "LOCKBODY-FOUR-BULLETS"
    match = re.match(
        r"^(CROOK-SM|GRID-SM|SQED-SM|SPAZY|GRAZ|CRUMPY|DORON|FACER|FORNIS|COIL|DUCT|SKINY|ERA)\b",
        c,
    )
    if match:
        return match.group(1)
    if re.match(r"^NAROW \d", c):
        return "NAROW-pull"
    fam = c.split()[0]
    if " Rose Handle" in c or " Baby Latch" in c or " LB " in c:
        return f"{fam}-rose"
    if c in {
        "FRIDA",
        "ZETA",
        "VING",
        "COLON",
        "COSA",
        "CONE",
        "MONOC",
        "ZARDIN",
        "DEW",
        "NAROW",
        "PITON",
        "SCURA",
        "STIM",
        "BOMMA",
        "FLIP",
        "PEBB",
        "DROP",
        "LENI",
        "PYRITE",
    }:
        return f"{c}-plate"
    return None


def is_card_grey(r: int, g: int, b: int) -> bool:
    avg = (r + g + b) / 3
    return 48 <= avg <= 145 and abs(r - g) < 22 and abs(g - b) < 22


def detect_cards(img: Image.Image) -> list[tuple[int, int, int, int]]:
    width, height = img.size
    pixels = img.load()
    grey = [[False] * width for _ in range(height)]
    for y in range(height):
        for x in range(width):
            grey[y][x] = is_card_grey(*pixels[x, y])
    row_frac = [sum(grey[y]) / width for y in range(height)]
    y_bands: list[tuple[int, int]] = []
    start = None
    for y, frac in enumerate(row_frac):
        hit = frac > 0.05
        if hit and start is None:
            start = y
        elif not hit and start is not None:
            if y - start >= height * 0.07:
                y_bands.append((start, y))
            start = None
    if start is not None and height - start >= height * 0.07:
        y_bands.append((start, height))

    merge_gap = max(3, int(width * 0.004))
    cards: list[tuple[int, int, int, int]] = []
    for y0, y1 in y_bands:
        col = [0] * width
        for y in range(y0, y1):
            for x in range(width):
                if grey[y][x]:
                    col[x] += 1
        band_h = y1 - y0
        occupied = [count / band_h > 0.15 for count in col]
        spans: list[tuple[int, int]] = []
        start_x = None
        for x, hit in enumerate(occupied):
            if hit and start_x is None:
                start_x = x
            elif not hit and start_x is not None:
                if x - start_x >= width * 0.07:
                    spans.append((start_x, x))
                start_x = None
        if start_x is not None and width - start_x >= width * 0.07:
            spans.append((start_x, width))
        merged: list[tuple[int, int]] = []
        for left, right in spans:
            if merged and left - merged[-1][1] < merge_gap:
                merged[-1] = (merged[-1][0], right)
            else:
                merged.append((left, right))
        for x0, x1 in merged:
            frac_w = (x1 - x0) / width
            frac_h = (y1 - y0) / height
            if frac_w < 0.10 or frac_w >= 0.85 or frac_h < 0.09:
                continue
            if y0 / height < 0.12:
                continue
            cards.append((x0, y0, x1, y1))

    cards.sort(key=lambda box: (box[1] // 10, box[0]))
    return cards


def photo_table_split(img: Image.Image, x0: int, y0: int, x1: int, y1: int) -> int:
    pixels = img.load()
    width = x1 - x0
    lo = x0 + int(width * 0.30)
    hi = x0 + int(width * 0.39)
    best = 0
    best_x = x0 + int(width * 0.355)
    for x in range(lo, hi):
        score = 0
        for y in range(y0 + 8, y1 - 8, 2):
            left = sum(pixels[x - 1, y]) / 3
            right = sum(pixels[x, y]) / 3
            score += abs(left - right)
        if score > best:
            best = score
            best_x = x
    return best_x


def crop_card(img: Image.Image, box: tuple[int, int, int, int], page_index: int) -> Image.Image:
    x0, y0, x1, y1 = box
    page_w, page_h = img.size
    frac_w = (x1 - x0) / page_w
    frac_h = (y1 - y0) / page_h
    pad = max(3, int(min(x1 - x0, y1 - y0) * 0.02))
    if frac_w < 0.26:
        keep = 0.62 if frac_h > 0.21 else 0.80
        y1 = y0 + int((y1 - y0) * keep)
        pad_y = max(2, int((y1 - y0) * 0.012))
        return img.crop((x0 + pad, y0 + pad_y, x1 - pad, y1 - pad))
    if page_index == 10:
        split = x0 + int((x1 - x0) * 0.33)
    else:
        split = photo_table_split(img, x0, y0, x1, y1)
    trim_r = max(4, int((x1 - x0) * 0.018))
    return img.crop((x0 + pad, y0 + pad, split - trim_r, y1 - pad))


def main() -> None:
    if OUT_DIR.exists():
        shutil.rmtree(OUT_DIR)
    OUT_DIR.mkdir(parents=True)
    doc = pymupdf.open(PDF)
    cropped: dict[str, Path] = {}

    for page_index, keys in PAGE_KEYS.items():
        page = doc[page_index]
        pix = page.get_pixmap(matrix=pymupdf.Matrix(ZOOM, ZOOM), alpha=False)
        img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
        cards = detect_cards(img)
        if len(cards) < len(keys):
            raise SystemExit(f"page {page_index + 1}: found {len(cards)} cards, need {len(keys)}")
        cards = cards[: len(keys)]
        for key, box in zip(keys, cards):
            tile = crop_card(img, box, page_index)
            if tile.width < 24 or tile.height < 24:
                raise SystemExit(f"empty crop {key}")
            dest = OUT_DIR / f"{key}.webp"
            tile.save(dest, "WEBP", quality=82, method=6)
            cropped[key] = dest
        print(f"page {page_index + 1}: {len(keys)} photos")

    keys = sorted(cropped)
    CODES_JSON.write_text(json.dumps(keys, indent=2) + "\n")
    codes = seed_codes()
    mapped = [(c, aura_key(c)) for c in codes]
    uncovered = [c for c, k in mapped if not k or k not in cropped]
    print(f"files {len(keys)}")
    print(f"SKU coverage {len(codes) - len(uncovered)} / {len(codes)}")
    if uncovered:
        print("uncovered SKUs:")
        for code in uncovered:
            print(f"  {code} -> {aura_key(code)}")


if __name__ == "__main__":
    main()
