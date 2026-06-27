# /// script
# requires-python = ">=3.12"
# dependencies = ["pillow>=10", "numpy>=1.26"]
# ///
"""Poster reproduction measurement toolkit.

Measure an EXISTING poster (a rendered PNG, or a PDF page exported to PNG at a
known DPI) in REAL units, so an RPS reproduction can be built to a measured spec
instead of by eye.  The #1 cause of "looks nothing like the original" is using
default / too-small type on a huge A0 canvas: measure the title/body point sizes
FIRST, set them, then build.

Run with uv (never bare python):

  uv run measure-poster.py info  IMG [--wmm 841]
  uv run measure-poster.py color IMG X Y
  uv run measure-poster.py text  IMG X0 Y0 X1 Y1 [--mode dark|white] [--wmm 841]
  uv run measure-poster.py bands IMG [--x 1000] [--wmm 841] [--hmm 1189]
                                     [--target R,G,B] [--tol 60]
  uv run measure-poster.py crop  IMG X Y W H OUT

Coordinates are pixels in the source image (origin top-left).  Paper width
defaults to A0 portrait (841 mm); pass --wmm for A1 (594) etc.

Font size from pixels:  font_pt = (em_px * mm_per_px) / 0.3528
  - With >=2 text lines, em is derived from the line PITCH (baseline-to-baseline)
    assuming line-height 1.2 -> most reliable.
  - With 1 line, em is derived from the ink band height / 0.72 (cap-height ratio).
"""
from __future__ import annotations

import sys

import numpy as np
from PIL import Image

PT_MM = 0.3528  # 1 pt in mm


def _gray(path: str) -> tuple[np.ndarray, np.ndarray, int, int]:
    rgb = np.asarray(Image.open(path).convert("RGB"), dtype=np.float64)
    gray = rgb.mean(axis=2)
    h, w = gray.shape
    return rgb, gray, w, h


def _runs(mask: np.ndarray, min_len: int) -> list[tuple[int, int]]:
    """Contiguous True runs in a 1-D boolean array -> list of (start, end_excl)."""
    runs: list[tuple[int, int]] = []
    start = -1
    for i, v in enumerate(mask):
        if v and start < 0:
            start = i
        elif not v and start >= 0:
            if i - start >= min_len:
                runs.append((start, i))
            start = -1
    if start >= 0 and len(mask) - start >= min_len:
        runs.append((start, len(mask)))
    return runs


def _kw(args: list[str]) -> dict[str, str]:
    out: dict[str, str] = {}
    i = 0
    while i < len(args):
        if args[i].startswith("--"):
            out[args[i][2:]] = args[i + 1]
            i += 2
        else:
            i += 1
    return out


def cmd_info(args: list[str]) -> None:
    kw = _kw(args[1:])
    wmm = float(kw.get("wmm", 841))
    _, _, w, h = _gray(args[0])
    mpp = wmm / w
    print(f"image      : {w} x {h} px")
    print(f"paper width: {wmm} mm  ->  mm_per_px = {mpp:.4f}  ({1/mpp:.3f} px/mm)")
    print(f"implied H  : {h * mpp:.1f} mm  (A0 portrait = 1189; A1 = 841)")


def cmd_color(args: list[str]) -> None:
    rgb, _, _, _ = _gray(args[0])
    x, y = int(args[1]), int(args[2])
    r, g, b = (int(v) for v in rgb[y, x])
    print(f"({x},{y}) = rgb({r},{g},{b})  #{r:02x}{g:02x}{b:02x}")


def cmd_text(args: list[str]) -> None:
    kw = _kw(args[5:])
    wmm = float(kw.get("wmm", 841))
    mode = kw.get("mode", "dark")
    x0, y0, x1, y1 = (int(v) for v in args[1:5])
    _, gray, w, _ = _gray(args[0])
    mpp = wmm / w
    region = gray[y0:y1, x0:x1]
    ink = region < 110 if mode == "dark" else region > 200
    per_row = ink.sum(axis=1)
    thr = max(3, per_row.max() * 0.08)
    bands = _runs(per_row > thr, min_len=3)
    if not bands:
        print("no text lines found (try a different box or --mode)")
        return
    heights = [e - s for s, e in bands]
    centers = [(s + e) / 2 for s, e in bands]
    pitches = [centers[i + 1] - centers[i] for i in range(len(centers) - 1)]
    med_h = float(np.median(heights))
    print(f"mode={mode}  box=({x0},{y0})-({x1},{y1})  mm_per_px={mpp:.4f}")
    print(f"lines found: {len(bands)}")
    for s, e in bands:
        print(f"  y[{y0+s}-{y0+e}]  h={e-s}px  {(e-s)*mpp:.1f}mm")
    print(f"median line ink height: {med_h:.1f}px  {med_h*mpp:.1f}mm")
    if pitches:
        med_p = float(np.median(pitches))
        em = med_p / 1.2
        print(f"median line pitch     : {med_p:.1f}px  {med_p*mpp:.1f}mm")
        print(f">> font ~ {(em*mpp)/PT_MM:.0f} pt   (from pitch, line-height 1.2)")
    print(f">> font ~ {(med_h/0.72*mpp)/PT_MM:.0f} pt   (from cap-height band/0.72)")


def cmd_bands(args: list[str]) -> None:
    kw = _kw(args[1:])
    wmm = float(kw.get("wmm", 841))
    hmm = float(kw.get("hmm", 1189))
    rgb, _, w, h = _gray(args[0])
    mpp_y = hmm / h
    x = int(kw.get("x", w // 2))
    tol = float(kw.get("tol", 60))
    tgt = kw.get("target", "176,28,46")
    tr, tg, tb = (float(v) for v in tgt.split(","))
    col = rgb[:, x, :]
    dist = np.sqrt((col[:, 0] - tr) ** 2 + (col[:, 1] - tg) ** 2 + (col[:, 2] - tb) ** 2)
    bands = _runs(dist < tol, min_len=8)
    print(f"vertical scan x={x}  target=rgb({tr:.0f},{tg:.0f},{tb:.0f}) tol={tol}  mm_per_px_y={mpp_y:.4f}")
    if not bands:
        print("no matching colored bands on this column (adjust --x / --target / --tol)")
        return
    for s, e in bands:
        print(f"  y[{s}-{e}]  {s*mpp_y:.0f}-{e*mpp_y:.0f}mm  height={ (e-s)*mpp_y:.0f}mm")


def cmd_crop(args: list[str]) -> None:
    x, y, ww, hh = (int(v) for v in args[1:5])
    out = args[5]
    Image.open(args[0]).convert("RGB").crop((x, y, x + ww, y + hh)).save(out)
    print(f"cropped ({x},{y},{ww}x{hh}) -> {out}")


def main() -> None:
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    cmd, rest = sys.argv[1], sys.argv[2:]
    {
        "info": cmd_info,
        "color": cmd_color,
        "text": cmd_text,
        "bands": cmd_bands,
        "crop": cmd_crop,
    }.get(cmd, lambda _a: (print(__doc__), sys.exit(1)))(rest)


if __name__ == "__main__":
    main()
