"""RPC bridge to the same FastAPI application functions, running inside a Python worker.

No financial model is reimplemented here. Worker filesystem/session state is private to a visitor's tab.
"""

import json

import numpy as np
import pandas as pd


def initialize(fixture):
    from backend.app import main
    from portfolio_analytics.accounting import Transaction

    main.prices = pd.DataFrame(fixture["prices"], index=fixture["dates"], columns=fixture["symbols"])
    main.benchmark = np.asarray(fixture["benchmark"], dtype=np.float64)
    main.sample_tx = [Transaction.model_validate(t) for t in fixture["transactions"]]
    main.transactions = list(main.sample_tx)
    main.previews.clear()
    main.runs.clear()
    main.committed.clear()
    main.prices.to_parquet(main.STATE / "synthetic_prices.parquet")
    return dict(numpy=np.__version__, pandas=pd.__version__, python_worker=True)


def dispatch(url, body=None):
    from backend.app import main

    if url == "/portfolios":
        return main.portfolios()
    if url == "/portfolios/sample/overview":
        return main.overview()
    if url == "/portfolios/sample/simulation-runs":
        result = main.simulation(main.SimulationConfig.model_validate(body or {}))
        result["runtime"] = dict(engine="Pyodide Python worker", numpy=np.__version__, pandas=pd.__version__)
        return result
    if url == "/portfolios/sample/risk-runs":
        return main.risk_run()
    if url == "/portfolios/sample/scenario-runs":
        return main.scenario(main.ScenarioConfig.model_validate(body or {}))
    if url == "/imports/preview":
        return main.preview(main.CSVRequest.model_validate(body or {}))
    if url.startswith("/imports/") and url.endswith("/commit"):
        return main.commit(url.split("/")[2])
    if url.startswith("/runs/"):
        run_id = url.split("/")[2]
        if url.endswith("/exports"):
            return json.loads(main.export(run_id).body)
        return main.get_run(run_id)
    raise ValueError("Unknown public demo endpoint")
