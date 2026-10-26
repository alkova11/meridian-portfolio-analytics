"""Prepare a public browser-Python bundle from synthetic inputs only."""

import hashlib
import json
import os
import shutil
import tempfile

from portfolio_analytics.sample import ROOT, SYMBOLS, sample

output = ROOT / "frontend/public"
(output / "python").mkdir(parents=True, exist_ok=True)
files = [
    "src/portfolio_analytics/__init__.py",
    "src/portfolio_analytics/accounting.py",
    "src/portfolio_analytics/analytics.py",
    "src/portfolio_analytics/sample.py",
    "src/portfolio_analytics/web_runtime.py",
    "backend/app/main.py",
    "uv.lock",
]
for file in files:
    target = output / "python" / file
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(ROOT / file, target)
(output / "python/bundle.json").write_text(json.dumps(files))
prices, benchmark, transactions = sample()
fixture = dict(
    dates=prices.index.tolist(),
    symbols=SYMBOLS,
    prices=prices.to_numpy().tolist(),
    benchmark=benchmark.tolist(),
    transactions=[t.model_dump(mode="json") for t in transactions],
)
(output / "demo-fixture.json").write_text(json.dumps(fixture, allow_nan=False))
with tempfile.TemporaryDirectory(prefix="meridian-public-build-") as temporary:
    os.environ["MERIDIAN_STATE_DIRECTORY"] = temporary
    from backend.app import main

    main.transactions = transactions
    main.prices = prices
    main.benchmark = benchmark
    overview = main.overview()
    simulation = main.simulation(main.SimulationConfig())
    simulation["runtime"] = dict(engine="precomputed Python sample", cached=True)
    simulation["artifact_path"] = "frontend/public/demo-bootstrap.json#simulation"
    overview["assumptions"] += [
        "Public demo: default sample results are precomputed with this Python package; custom calculations run in a browser Python worker.",
        "Public demo: CSV import state is isolated in this tab and resets when the page reloads. No CSV is sent to a server.",
        "Browser Python package versions differ from the native uv lock. Cross-runtime random path equality is not promised.",
    ]
    simulation["overview_snapshot"] = overview
    (output / "demo-bootstrap.json").write_text(
        json.dumps(dict(overview=overview, simulation=simulation), allow_nan=False)
    )
shutil.copy2(ROOT / "reports/figures/project-overview.png", output / "project-overview.png")
manifest = {file: hashlib.sha256((ROOT / file).read_bytes()).hexdigest() for file in files}
(output / "python/source-manifest.json").write_text(json.dumps(manifest, indent=2))
print("Public demo assets generated exclusively from synthetic inputs.")
