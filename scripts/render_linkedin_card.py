"""Render a LinkedIn project card using the verified live dashboard screenshot."""

from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.image as mpimg
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "reports/figures/linkedin-launch.png"
BG, FG, MUTED, BLUE = "#0c1015", "#eef3f8", "#91a5bb", "#9fc4ff"

fig = plt.figure(figsize=(16, 9), dpi=100, facecolor=BG)
canvas = fig.add_axes((0, 0, 1, 1), xlim=(0, 1600), ylim=(900, 0))
canvas.axis("off")


def label(x, y, value, size=15, color=FG, weight="normal", **kwargs):
    canvas.text(
        x,
        y,
        value,
        fontsize=size * 0.72,
        color=color,
        fontfamily="DejaVu Sans",
        weight=weight,
        va="top",
        **kwargs,
    )


canvas.add_patch(
    FancyBboxPatch((64, 54), 48, 42, boxstyle="round,pad=0,rounding_size=8", facecolor=BLUE, edgecolor="none")
)
label(74, 62, "m", 27, BG, "bold")
label(128, 69, "Q U A N T I T A T I V E   R E S E A R C H", 14, MUTED)
label(1536, 69, "PYTHON · FASTAPI · REACT · TYPESCRIPT · PLOTLY", 11, MUTED, ha="right")

label(64, 172, "Your portfolio.", 67, weight="bold")
label(64, 251, "Your perspective.", 61, BLUE, "bold")
label(64, 357, "A configurable portfolio analytics app.", 22, MUTED)
label(64, 393, "Returns, risk and scenarios, explained.", 22, MUTED)

label(64, 474, "10", 52, BLUE)
label(64, 538, "Analytical sections", 15, MUTED)
label(64, 565, "Choose · resize · reorder · restyle", 12, MUTED)
label(330, 474, "FIFO", 52, BLUE)
label(330, 538, "Decimal accounting", 15, MUTED)
label(330, 565, "Cash flows separated from returns", 12, MUTED)

# Place the native hosting screenshot as a real app image, preserving its aspect ratio.
shot = mpimg.imread(ROOT / "reports/figures/dashboard-live.png")
frame = FancyBboxPatch(
    (676, 165),
    860,
    537.5,
    boxstyle="round,pad=0,rounding_size=12",
    facecolor="#11171e",
    edgecolor="#34475d",
    linewidth=0.8,
)
canvas.add_patch(frame)
picture = canvas.imshow(shot, extent=(676, 1536, 702.5, 165), zorder=2)
picture.set_clip_path(frame)

for y in (735, 807):
    canvas.plot((64, 1536), (y, y), color="#2b3642", linewidth=0.8)
label(64, 757, "TWR", 26)
label(137, 765, "Cash-flow-aware returns", 14, MUTED)
label(405, 757, "10,000", 26)
label(521, 765, "default simulation paths", 14, MUTED)
label(1536, 765, "Public web app · reproducible Python engine", 14, BLUE, ha="right")
label(64, 855, "Meridian — Portfolio Analytics & Risk Dashboard", 15, FG)
label(
    1536, 855, "Synthetic EUR demo · Conditional scenarios, not investment forecasts.", 12, MUTED, ha="right"
)

fig.savefig(OUTPUT, dpi=100, facecolor=BG)
plt.close(fig)
print(f"Rendered {OUTPUT.relative_to(ROOT)} (1600 × 900).")
