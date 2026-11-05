#!/usr/bin/env python3
"""Generate 640 px-wide responsive variants of the BEYBOO catalogue images.

Run with:  python3 -I scripts/make-image-variants.py   (npm run images:variants)

For every .webp under public/assets/{studio,world,universe,usages} that is wider
than 700 px, a <name>-640.webp sibling is written (quality 80, method 6). The
original files are never touched. An existing variant that is newer than its
source is skipped, so the script is cheap to re-run.

It then writes public/assets/variants.json (original path -> original width for
every image that has a -640 sibling) and inlines the same map as the
`imageVariants` constant in public/universe-data.js and public/en/universe-data.js
between the "@generated image-variants" markers. Those two files load before
app.js / universe.js, whose image helpers only reference a -640 variant when its
source appears in that map.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:  # pragma: no cover - environment check
    sys.exit("Pillow is required: python3 -m pip install pillow")

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"
FOLDERS = ["studio", "world", "universe", "usages"]
MIN_SOURCE_WIDTH = 700
VARIANT_WIDTH = 640
SUFFIX = f"-{VARIANT_WIDTH}"
# Derived files (our own output, and the hand-made 836 px "-small" usages
# pictures) are not sources: no variant of a variant.
SKIP_SUFFIXES = (SUFFIX, "-small")
MANIFEST = PUBLIC / "assets" / "variants.json"
DATA_FILES = [PUBLIC / "universe-data.js", PUBLIC / "en" / "universe-data.js"]
START = "// @generated image-variants start"
END = "// @generated image-variants end"


def is_source(path: Path) -> bool:
    return path.suffix == ".webp" and not path.stem.endswith(SKIP_SUFFIXES)


def make_variant(source: Path, target: Path) -> bool:
    """Write the 640 px variant unless it already exists and is up to date."""
    if target.exists() and target.stat().st_mtime >= source.stat().st_mtime:
        return False
    with Image.open(source) as image:
        width, height = image.size
        new_height = max(1, round(height * VARIANT_WIDTH / width))
        resized = image.resize((VARIANT_WIDTH, new_height), Image.Resampling.LANCZOS)
        tmp = target.with_name(target.name + ".tmp")
        resized.save(tmp, "WEBP", quality=80, method=6)
    os.replace(tmp, target)
    return True


def inline_constant(data_file: Path, manifest: dict[str, int]) -> bool:
    text = data_file.read_text(encoding="utf-8")
    start = text.find(START)
    end = text.find(END)
    if start < 0 or end < 0 or end < start:
        sys.exit(f"{data_file}: missing {START!r} / {END!r} markers")
    start += len(START)
    body = "\nconst imageVariants = " + json.dumps(manifest, ensure_ascii=False, separators=(",", ":")) + ";\n"
    updated = text[:start] + body + text[end:]
    if updated == text:
        return False
    data_file.write_text(updated, encoding="utf-8")
    return True


def main() -> int:
    written = 0
    skipped = 0
    manifest: dict[str, int] = {}
    variant_bytes = 0
    source_bytes = 0
    for folder in FOLDERS:
        base = PUBLIC / "assets" / folder
        if not base.is_dir():
            print(f"warning: {base} not found", file=sys.stderr)
            continue
        for source in sorted(base.iterdir()):
            if not is_source(source):
                continue
            with Image.open(source) as image:
                width = image.size[0]
            if width <= MIN_SOURCE_WIDTH:
                continue
            target = source.with_name(source.stem + SUFFIX + ".webp")
            if make_variant(source, target):
                written += 1
            else:
                skipped += 1
            manifest[source.relative_to(PUBLIC).as_posix()] = width
            variant_bytes += target.stat().st_size
            source_bytes += source.stat().st_size

    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    changed = [str(f.relative_to(ROOT)) for f in DATA_FILES if inline_constant(f, manifest)]

    total = len(manifest)
    print(f"{total} variants ({written} written, {skipped} up to date), "
          f"{variant_bytes:,} bytes vs {source_bytes:,} bytes of originals "
          f"({100 - 100 * variant_bytes / max(source_bytes, 1):.0f}% smaller)")
    print(f"manifest: {MANIFEST.relative_to(ROOT)}")
    print("updated: " + (", ".join(changed) if changed else "nothing (constants already current)"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
