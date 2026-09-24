#!/usr/bin/env python3
"""Crop product photos from the Laksh cabinet-handles PDF and match them to MD-xxx codes."""

from __future__ import annotations

import gzip
import json
import re
from pathlib import Path

import pymupdf
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PDF = ROOT / "catalog_pdfs" / "laksh-cabinet-handles-md-001-to-md-206.pdf"
SEED = ROOT / "data" / "catalog-seed.json.gz"
OUT_DIR = ROOT / "public" / "catalog" / "laksh"
CODES_JSON = ROOT / "src" / "lib" / "catalog" / "laksh-image-codes.json"
ZOOM = 3.5
# "PRODUCT- MD-001", "PRODUCT - MD-007", "PRODUCT MD-049"
CODE_RE = re.compile(r"PRODUCT\s*-?\s*(MD-\d+)", re.I)


def seed_codes_through_202() -> list[str]:
    data = json.loads(gzip.decompress(SEED.read_bytes()))
    laksh = next(s for s in data["suppliers"] if s["name"] == "Laksh")
    catalog = next(
        c
        for c in data["catalogs"]
        if c["supplier_id"] == laksh["id"] and "Cabinet Handles" in c["name"]
    )
    codes = []
    for product in data["products"]:
        if product["catalog_id"] != catalog["id"]:
            continue
        code = product["code"].upper()
        match = re.fullmatch(r"MD-(\d+)", code)
        if match and int(match.group(1)) <= 202:
            codes.append(code)
    return sorted(set(codes), key=lambda c: int(c.split("-")[1]))


def headings(page: pymupdf.Page) -> list[tuple[str, float]]:
    found: list[tuple[str, float]] = []
    seen: set[str] = set()
    for block in page.get_text("dict")["blocks"]:
        if block.get("type") != 0:
            continue
        text = " ".join(
            span["text"]
            for line in block.get("lines", [])
            for span in line.get("spans", [])
        )
        match = CODE_RE.search(text)
        if not match:
            continue
        code = match.group(1).upper()
        if code in seen:
            continue
        seen.add(code)
        found.append((code, block["bbox"][1]))
    found.sort(key=lambda item: item[1])
    return found


def left_images(page: pymupdf.Page) -> list[pymupdf.Rect]:
    rects: list[pymupdf.Rect] = []
    for block in page.get_text("dict")["blocks"]:
        if block.get("type") != 1:
            continue
        x0, y0, x1, y1 = block["bbox"]
        width = x1 - x0
        height = y1 - y0
        if y0 < 40:
            continue
        if x0 > 145 or width < 8 or height < 8:
            continue
        rects.append(pymupdf.Rect(x0, y0, x1, y1))
    return rects


def clusters(rects: list[pymupdf.Rect]) -> list[list[pymupdf.Rect]]:
    if not rects:
        return []
    ordered = sorted(rects, key=lambda r: r.y0)
    groups: list[list[pymupdf.Rect]] = [[ordered[0]]]
    for rect in ordered[1:]:
        prev = groups[-1][-1]
        if rect.y0 - prev.y1 <= 14:
            groups[-1].append(rect)
        else:
            groups.append([rect])
    return groups


def union(rects: list[pymupdf.Rect]) -> pymupdf.Rect | None:
    if not rects:
        return None
    box = pymupdf.Rect(rects[0])
    for rect in rects[1:]:
        box |= rect
    box.x0 -= 2
    box.y0 -= 2
    box.x1 += 2
    box.y1 += 2
    if box.width < 20 or box.height < 20:
        return None
    return box


def save_webp(pix: pymupdf.Pixmap, dest: Path) -> None:
    mode = "RGBA" if pix.alpha else "RGB"
    img = Image.frombytes(mode, (pix.width, pix.height), pix.samples)
    if img.mode == "RGBA":
        bg = Image.new("RGB", img.size, (255, 255, 255))
        bg.paste(img, mask=img.split()[-1])
        img = bg
    img.save(dest, "WEBP", quality=82, method=6)


def crop(page: pymupdf.Page, box: pymupdf.Rect, dest: Path, matrix: pymupdf.Matrix) -> None:
    pix = page.get_pixmap(matrix=matrix, clip=box & page.rect, alpha=False)
    save_webp(pix, dest)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    expected = seed_codes_through_202()
    doc = pymupdf.open(PDF)
    matrix = pymupdf.Matrix(ZOOM, ZOOM)
    cropped: dict[str, Path] = {}
    leftovers: list[tuple[int, float, pymupdf.Page, pymupdf.Rect]] = []

    for index, page in enumerate(doc):
        heads = headings(page)
        groups = clusters(left_images(page))
        used: set[int] = set()
        bounds: list[tuple[str, float, float]] = []
        for i, (code, y) in enumerate(heads):
            y1 = heads[i + 1][1] if i + 1 < len(heads) else page.rect.y1
            bounds.append((code, y - 8, y1))

        for gi, group in enumerate(groups):
            box = union(group)
            if not box:
                continue
            cy = (box.y0 + box.y1) / 2
            matched = None
            for code, y0, y1 in bounds:
                if y0 <= cy < y1 and code not in cropped:
                    matched = code
                    break
            if matched:
                dest = OUT_DIR / f"{matched}.webp"
                crop(page, box, dest, matrix)
                cropped[matched] = dest
                used.add(gi)

        for gi, group in enumerate(groups):
            if gi in used:
                continue
            box = union(group)
            if box:
                leftovers.append((index, box.y0, page, box))

    # Dedupe leftovers (a group can be recorded twice if logic overlaps)
    unique_left = []
    seen_box = set()
    for item in leftovers:
        key = (item[0], round(item[1], 1), round(item[3].x0, 1), round(item[3].y1, 1))
        if key in seen_box:
            continue
        seen_box.add(key)
        unique_left.append(item)
    unique_left.sort(key=lambda item: (item[0], item[1]))

    missing = [code for code in expected if code not in cropped]
    for code, leftover in zip(missing, unique_left):
        _, _, page, box = leftover
        dest = OUT_DIR / f"{code}.webp"
        crop(page, box, dest, matrix)
        cropped[code] = dest

    still = [code for code in expected if code not in cropped]
    extra = unique_left[len(missing) :]

    unique = [code for code in expected if code in cropped]
    CODES_JSON.write_text(json.dumps(unique, indent=2) + "\n")
    print(f"cropped {len(unique)} / {len(expected)} SKUs through MD-202")
    if still:
        print("still missing:", ", ".join(still))
    if extra:
        print(f"unused leftover photos: {len(extra)}")
    over = [c for c in cropped if c not in expected]
    if over:
        print("beyond 202 (ignored in index):", ", ".join(over))


if __name__ == "__main__":
    main()
