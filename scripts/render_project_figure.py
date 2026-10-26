"""Render a research figure from frozen results. This is not a UI screenshot."""

import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
os.environ.setdefault("MPLCONFIGDIR", str(ROOT / ".matplotlib-cache"))
import matplotlib  # noqa: E402 -- configure a writable cache before importing

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402 -- select headless Agg before pyplot
from matplotlib.ticker import FuncFormatter  # noqa: E402

report = json.loads((ROOT / "reports/publication/synthetic-demo.json").read_text())
sim = report["simulation"]
plt.rcParams.update(
    {
        "font.family": "DejaVu Sans",
        "font.size": 9,
        "axes.facecolor": "#0b1220",
        "figure.facecolor": "#080d16",
        "text.color": "#d5e2f4",
        "axes.labelcolor": "#8399b4",
        "xtick.color": "#7189a6",
        "ytick.color": "#7189a6",
        "axes.edgecolor": "#23344c",
        "grid.color": "#1b2a3e",
        "savefig.facecolor": "#080d16",
    }
)
fig = plt.figure(figsize=(16, 9), dpi=150)
fig.text(0.055, 0.925, "MERIDIAN", fontsize=27, fontweight="bold", color="#e3edfa")
fig.text(
    0.055,
    0.887,
    "Portfolio accounting, risk analytics & reproducible simulation",
    fontsize=14,
    color="#8faed3",
)
fig.text(0.945, 0.925, "PYTHON  /  FASTAPI  /  REACT  /  PLOTLY", ha="right", fontsize=8, color="#738baa")
fig.text(0.945, 0.887, "SYNTHETIC EUR DEMONSTRATION", ha="right", fontsize=9, color="#c4b386")
labels = [
    ("ANNUALISED VOLATILITY", f"{report['risk']['volatility']:.2%}"),
    ("SHARPE / 2% RISK-FREE", f"{report['risk']['sharpe']:.2f}"),
    ("MAXIMUM DRAWDOWN", f"{report['risk']['max_drawdown']:.2%}"),
    ("SIMULATED LOSS PROBABILITY", f"{sim['probability_loss']:.2%}"),
]
for i, (label, value) in enumerate(labels):
    x = 0.055 + i * 0.231
    fig.text(x, 0.819, label, fontsize=8, color="#738dab")
    fig.text(x, 0.775, value, fontsize=21, color="#b8d1f5")
gs = fig.add_gridspec(
    2, 3, left=0.065, right=0.945, bottom=0.15, top=0.72, wspace=0.29, hspace=0.38, height_ratios=[1.08, 1]
)
wealth = fig.add_subplot(gs[0, :2])
dd = fig.add_subplot(gs[1, :2])
fan = fig.add_subplot(gs[:, 2])
for ax in [wealth, dd, fan]:
    ax.grid(alpha=0.5, linewidth=0.5)
    ax.set_axisbelow(True)
    ax.spines[["top", "right"]].set_visible(False)
    ax.tick_params(labelsize=8)
wealth.plot(report["wealth"], color="#88b7ff", linewidth=1.4, label="Portfolio")
wealth.plot(report["benchmark_wealth"], color="#62718b", linewidth=1, label="Synthetic benchmark")
wealth.set_title("Time-weighted wealth · rebased EUR 100,000", loc="left", fontsize=10, pad=12)
wealth.yaxis.set_major_formatter(FuncFormatter(lambda v, _: f"{v / 1000:.0f}k"))
wealth.legend(frameon=False, loc="upper left", fontsize=8, labelcolor="#a0b7d2")
dates = report["dates"]
ticks = [0, len(dates) // 2, len(dates) - 1]
for ax in [wealth, dd]:
    ax.set_xticks(ticks, [dates[i][:7] for i in ticks])
dd.fill_between(range(len(report["drawdown"])), report["drawdown"], 0, color="#a95165", alpha=0.13)
dd.plot(report["drawdown"], color="#d27b89", linewidth=1)
dd.set_title("Historical drawdown · from running wealth peak", loc="left", fontsize=10, pad=12)
dd.yaxis.set_major_formatter(FuncFormatter(lambda v, _: f"{v:.0%}"))
q = sim["quantiles"]
days = range(len(q[0]))
fan.fill_between(days, q[0], q[4], color="#467bbe", alpha=0.22, label="p5–p95")
fan.fill_between(days, q[1], q[3], color="#5c96e6", alpha=0.34, label="p25–p75")
fan.plot(days, q[2], color="#a7cdff", linewidth=1.5, label="Median")
fan.set_title("10,000 paths / 252 model steps", loc="left", fontsize=10, pad=12)
fan.set_xlabel("Future weekday step")
fan.yaxis.set_major_formatter(FuncFormatter(lambda v, _: f"{v / 1000:.0f}k"))
fan.legend(frameon=False, fontsize=8, loc="upper left", labelcolor="#a0b7d2")
fig.text(
    0.055,
    0.086,
    "Standalone research figure — generated from implemented calculations; not a dashboard screenshot.",
    fontsize=8,
    color="#829ab8",
)
fig.text(
    0.055,
    0.058,
    "Synthetic data · seed 42 · buy-and-hold · constant cash · no future dividends/contributions · conditional outcomes, not forecasts",
    fontsize=7.5,
    color="#617b9c",
)
fig.text(0.945, 0.058, "As of " + report["as_of"], fontsize=7.5, color="#617b9c", ha="right")
output = ROOT / "reports/figures/project-overview.png"
fig.savefig(output, dpi=150)
plt.close(fig)
print(f"Figure saved: {output.relative_to(ROOT)} ({matplotlib.__version__})")
