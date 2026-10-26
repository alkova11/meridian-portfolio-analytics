"""Reproducible offline benchmark: python -m portfolio_analytics.cli."""

import json
from time import perf_counter

from portfolio_analytics.analytics import risk, simulate, value_history
from portfolio_analytics.sample import ROOT, SYMBOLS, sample


def main():
    start = perf_counter()
    prices, _, transactions = sample()
    frame, ledger = value_history(transactions, prices)
    units = [float(ledger.positions().get(s, (0, 0))[0]) for s in SYMBOLS]
    import numpy as np

    simulation = simulate(prices.to_numpy(), np.array(units), float(ledger.cash))
    report = {
        "fixture": "synthetic-seed-73-v1",
        "seed": 42,
        "paths": 10000,
        "horizon": 252,
        "portfolio_value": float(frame.value.iloc[-1]),
        "cash": float(ledger.cash),
        "risk": risk(frame.return_.to_numpy()[1:]),
        "terminal_mean": simulation["expected"],
        "p5": simulation["p5"],
        "p95": simulation["p95"],
        "probability_loss": simulation["probability_loss"],
        "elapsed_seconds": perf_counter() - start,
    }
    path = ROOT / "reports" / "benchmark.json"
    path.write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
