"""Export only the bundled synthetic fixture, never a user's local import state."""

import hashlib
import json
from datetime import datetime, timezone
from uuid import uuid4

import numpy as np

from portfolio_analytics.analytics import risk, simulate, value_history
from portfolio_analytics.sample import ROOT, SYMBOLS, sample

started = datetime.now(timezone.utc).isoformat()
prices, benchmark, transactions = sample()
history, ledger = value_history(transactions, prices)
units = np.array([float(ledger.positions().get(s, (0, 0))[0]) for s in SYMBOLS])
config = {"paths": 10000, "horizon": 252, "seed": 42, "method": "lognormal"}
simulation = simulate(prices.to_numpy(), units, float(ledger.cash), **config)
report = {
    "schema_version": "1.0",
    "run_id": str(uuid4()),
    "status": "succeeded",
    "started_at": started,
    "finished_at": datetime.now(timezone.utc).isoformat(),
    "git_commit": None,
    "dirty": None,
    "currency": "EUR",
    "synthetic": True,
    "dataset_id": "synthetic-seed-73-v1",
    "dataset_sha256": hashlib.sha256(prices.to_numpy().tobytes()).hexdigest(),
    "lock_sha256": hashlib.sha256((ROOT / "uv.lock").read_bytes()).hexdigest(),
    "config": config,
    "config_sha256": hashlib.sha256(json.dumps(config, sort_keys=True).encode()).hexdigest(),
    "as_of": prices.index[-1],
    "portfolio_value": float(history.value.iloc[-1]),
    "cash": float(ledger.cash),
    "net_external_capital": float(ledger.flows),
    "risk": risk(history.return_.to_numpy()[1:]),
    "dates": history.date.tolist(),
    "wealth": (history["index"] * 100000).tolist(),
    "benchmark_wealth": (benchmark / benchmark[0] * 100000).tolist(),
    "drawdown": history.drawdown.tolist(),
    "simulation": simulation,
    "artifact_paths": ["reports/publication/synthetic-demo.json", "reports/figures/project-overview.png"],
    "assumptions": [
        "Synthetic EUR data; no live market connection",
        "Flow-neutral wealth rebased to initial EUR 100,000",
        "Daily simple TWR; 252-day annualisation; 2% annual risk-free rate",
        "Simulation: buy-and-hold units, zero-yield cash, no future dividends or contributions",
        "Pointwise bands are conditional scenarios, not calibrated forecasts",
    ],
}
path = ROOT / "reports/publication/synthetic-demo.json"
path.parent.mkdir(parents=True, exist_ok=True)
path.write_text(json.dumps(report, indent=2, allow_nan=False))
print(f"Synthetic-only publication dataset saved: {path.relative_to(ROOT)}")
