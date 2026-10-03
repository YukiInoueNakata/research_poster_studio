# /// script
# requires-python = ">=3.11"
# dependencies = ["matplotlib>=3.8"]
# ///
"""猫の手ポスター（架空データ）の図を SVG で生成する（英語版・日本語版）．

数値はすべて架空．content.md の表と同じ値をここに持つので，変更するときは両方を直す．
文字は SVG 内でアウトライン化する（svg.fonttype=path）ので，閲覧側にフォントが無くても崩れない．

実行（examples/sample-cat-paws-en/ で）:
  uv run scripts/make_figures.py                                       # 英語版 → ./figures
  uv run scripts/make_figures.py --lang ja --out ../sample-cat-paws-ja/figures
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Ellipse

N = 12
TIME_M = [31.4, 27.9, 26.8, 35.7, 48.2]
TIME_SD = [6.2, 5.8, 6.5, 7.9, 10.4]
TYPO_M = [0.6, 1.4, 2.9, 8.7, 21.3]
TYPO_SD = [0.4, 0.9, 1.6, 3.9, 8.2]
MORALE_M = [3.2, 4.9, 5.4, 5.8, 6.1]
MORALE_SD = [1.1, 1.0, 0.9, 1.2, 1.0]

NAVY = "#1F3A5F"
ORANGE = "#D9822B"
GREY = "#9AA5B1"

TEXT = {
    "en": {
        "paws": ["0", "1", "2", "4", "8"],
        "xlabel": "Rented cat paws (= cats, one paw each)",
        "time": "Poster production time (h)",
        "sweet": "sweet spot",
        "typos": "Typos per page",
        "morale": "Author morale (1-7)",
        "cond": ["0 paws\n(control)", "1 paw\n(1 cat)", "2 paws\n(2 cats)", "4 paws\n(4 cats)", "8 paws\n(8 cats)"],
        "none": "none",
        "fonts": ["DejaVu Sans"],
    },
    "ja": {
        "paws": ["0", "1", "2", "4", "8"],
        "xlabel": "借りた猫の手の本数（＝猫の匹数）",
        "time": "ポスター作成時間（時間）",
        "sweet": "最適点",
        "typos": "1 ページあたりの誤字数",
        "morale": "著者の士気（1-7）",
        "cond": ["0 本\n（統制）", "1 本\n（猫 1 匹）", "2 本\n（猫 2 匹）", "4 本\n（猫 4 匹）", "8 本\n（猫 8 匹）"],
        "none": "なし",
        "fonts": ["Yu Gothic", "Hiragino Sans", "Noto Sans CJK JP", "IPAexGothic", "Meiryo"],
    },
}


def se(sd):
    return [s / N ** 0.5 for s in sd]


def fig_time(t, out):
    fig, ax = plt.subplots(figsize=(6.6, 4.4))
    colors = [GREY, ORANGE, ORANGE, NAVY, NAVY]
    bars = ax.bar(t["paws"], TIME_M, yerr=se(TIME_SD), capsize=5, color=colors, width=0.62)
    for b, m in zip(bars, TIME_M):
        ax.text(b.get_x() + b.get_width() / 2, m + 3.2, f"{m:.1f}", ha="center", fontsize=12)
    ax.set_ylabel(t["time"])
    ax.set_xlabel(t["xlabel"])
    ax.set_ylim(0, 58)
    ax.annotate(t["sweet"], xy=(1.5, 30.5), xytext=(1.5, 44), ha="center", color=ORANGE,
                fontsize=13, fontweight="bold",
                arrowprops=dict(arrowstyle="->", color=ORANGE, lw=1.6))
    fig.tight_layout()
    fig.savefig(out / "fig1_time.svg")
    plt.close(fig)


def fig_typos(t, out):
    fig, ax1 = plt.subplots(figsize=(6.6, 4.4))
    x = range(len(t["paws"]))
    ax1.errorbar(x, TYPO_M, yerr=se(TYPO_SD), color=NAVY, marker="o", lw=2.2, capsize=4,
                 label=t["typos"])
    ax1.set_ylabel(t["typos"], color=NAVY)
    ax1.set_xticks(list(x), t["paws"])
    ax1.set_xlabel(t["xlabel"])
    ax1.set_ylim(0, 26)
    ax2 = ax1.twinx()
    ax2.spines["right"].set_visible(True)
    ax2.errorbar(x, MORALE_M, yerr=se(MORALE_SD), color=ORANGE, marker="s", lw=2.2, capsize=4,
                 ls="--", label=t["morale"])
    ax2.set_ylabel(t["morale"], color=ORANGE)
    ax2.set_ylim(1, 7)
    h1, l1 = ax1.get_legend_handles_labels()
    h2, l2 = ax2.get_legend_handles_labels()
    ax1.legend(h1 + h2, l1 + l2, loc="upper left", frameon=False)
    fig.tight_layout()
    fig.savefig(out / "fig2_typos_morale.svg")
    plt.close(fig)


def paw(ax, x, y, r, color):
    """肉球 1 つ（掌球 1＋指球 4）を (x, y) 中心に描く．"""
    ax.add_patch(Ellipse((x, y - 0.15 * r), 1.1 * r, 0.9 * r, color=color))
    for dx, dy in [(-0.55, 0.45), (-0.2, 0.75), (0.2, 0.75), (0.55, 0.45)]:
        ax.add_patch(Ellipse((x + dx * r, y + dy * r), 0.36 * r, 0.44 * r, color=color))


def fig_conditions(t, out):
    """5 条件を肉球の数で示す模式図．"""
    counts = [0, 1, 2, 4, 8]
    fig, ax = plt.subplots(figsize=(10, 2.9))
    ax.set_xlim(0, 10)
    ax.set_ylim(-1.15, 1.6)
    ax.axis("off")
    r = 0.34
    for i, (n, lab) in enumerate(zip(counts, t["cond"])):
        cx = 1 + 2 * i
        color = GREY if n == 0 else (ORANGE if n <= 2 else NAVY)
        if n == 0:
            ax.text(cx, 0.55, t["none"], ha="center", va="center", color=GREY, fontsize=17, style="italic")
        else:
            cols = min(n, 4)
            rows = (n + 3) // 4
            for k in range(n):
                row, col = divmod(k, cols)
                px = cx + (col - (cols - 1) / 2) * (0.42 if cols == 4 else 0.62)
                py = 0.55 + ((rows - 1) / 2 - row) * 0.62
                paw(ax, px, py, r * (0.55 if cols == 4 else 1), color)
        ax.text(cx, -0.55, lab, ha="center", va="center", fontsize=15)
    fig.tight_layout()
    fig.savefig(out / "fig_conditions.svg")
    plt.close(fig)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang", choices=["en", "ja"], default="en")
    ap.add_argument("--out", type=Path, default=Path(__file__).resolve().parent.parent / "figures")
    a = ap.parse_args()
    t = TEXT[a.lang]
    plt.rcParams.update({
        "font.family": t["fonts"],
        "font.size": 15,
        "axes.spines.top": False,
        "axes.spines.right": False,
        "svg.fonttype": "path",
        "axes.unicode_minus": False,
    })
    a.out.mkdir(parents=True, exist_ok=True)
    fig_time(t, a.out)
    fig_typos(t, a.out)
    fig_conditions(t, a.out)
    for name in ("fig1_time.svg", "fig2_typos_morale.svg", "fig_conditions.svg"):
        p = a.out / name
        if not p.exists() or p.stat().st_size == 0:
            print(f"ERROR: {p} was not written", file=sys.stderr)
            sys.exit(1)
    print(f"OK: {a.lang} figures written to {a.out}")


if __name__ == "__main__":
    main()
