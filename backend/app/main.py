import csv
import hashlib
import io
import json
import os
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

from portfolio_analytics.accounting import Transaction
from portfolio_analytics.analytics import price_correlations, risk, simulate, value_history
from portfolio_analytics.sample import NAMES, ROOT, SECTORS, SYMBOLS, sample

app = FastAPI(title="Portfolio Analytics", version="0.1.0")
STATE = Path(os.environ.get("MERIDIAN_STATE_DIRECTORY", str(ROOT / "data" / "processed")))
STATE.mkdir(parents=True, exist_ok=True)
prices, benchmark, sample_tx = sample()
prices.to_parquet(STATE / "synthetic_prices.parquet")
transaction_file = STATE / "transactions.json"
transactions = (
    [Transaction.model_validate(t) for t in json.loads(transaction_file.read_text())]
    if transaction_file.exists()
    else sample_tx
)
previews = {}
runs = {}
committed_file = STATE / "committed.json"
committed = json.loads(committed_file.read_text()) if committed_file.exists() else {}


def checked_history():
    try:
        return value_history(transactions, prices)
    except ValueError as e:
        raise HTTPException(422, str(e)) from e


def metadata(config, result, started_at=None):
    run_id = str(uuid4())

    def sha(data):
        return hashlib.sha256(data).hexdigest()

    def git(*args):
        try:
            return (
                subprocess.check_output(["git", *args], cwd=ROOT, stderr=subprocess.DEVNULL).decode().strip()
            )
        except (OSError, subprocess.CalledProcessError):
            return None

    now = datetime.now(timezone.utc).isoformat()
    lock = ROOT / "uv.lock"
    snapshot = [t.model_dump(mode="json") for t in transactions]
    git_status = git("status", "--porcelain")
    record = dict(
        schema_version="1.0",
        run_id=run_id,
        config=config,
        config_sha256=sha(json.dumps(config, sort_keys=True).encode()),
        lock_sha256=sha(lock.read_bytes()) if lock.exists() else None,
        dataset_sha256=sha((STATE / "synthetic_prices.parquet").read_bytes()),
        dataset_id="synthetic-seed-73-v1",
        seed=config.get("seed"),
        git_commit=git("rev-parse", "HEAD"),
        dirty=None if git_status is None else bool(git_status),
        started_at=started_at or now,
        finished_at=now,
        status="succeeded",
        transaction_snapshot=snapshot,
        overview_snapshot=overview(),
        data_as_of=prices.index[-1],
        currency="EUR",
        result=result,
    )
    destination = STATE / f"{run_id}.json"
    record["artifact_path"] = (
        str(destination.relative_to(ROOT)) if destination.is_relative_to(ROOT) else destination.name
    )
    destination.write_text(json.dumps(record, allow_nan=False))
    runs[run_id] = record
    return record


@app.get("/api/portfolios")
def portfolios():
    return [dict(id="sample", name="Research portfolio", base_currency="EUR", synthetic=True)]


@app.get("/api/portfolios/sample/overview")
def overview():
    frame, ledger = checked_history()
    current = float(frame.value.iloc[-1])
    returns = frame.return_.to_numpy()[1:]
    metrics = risk(returns)
    holdings = []
    for s, (q, basis) in ledger.positions().items():
        i = SYMBOLS.index(s)
        value = float(q) * prices[s].iloc[-1]
        holdings.append(
            dict(
                symbol=s,
                name=NAMES[i],
                sector=SECTORS[i],
                quantity=float(q),
                basis=float(basis),
                price=float(prices[s].iloc[-1]),
                value=value,
                weight=value / current,
                unrealised=value - float(basis),
                daily=float(prices[s].iloc[-1] / prices[s].iloc[-2] - 1),
                spark=prices[s].iloc[-50:].tolist(),
            )
        )
    initial_capital = float(frame.flow.iloc[0])
    normalised_benchmark = benchmark / benchmark[0] * initial_capital
    # Both lines are wealth indices scaled to initial invested capital, excluding external flows.
    performance = dict(
        dates=frame.date.tolist(),
        values=frame["index"].mul(initial_capital).tolist(),
        actual_values=frame.value.tolist(),
        benchmark=normalised_benchmark.tolist(),
        drawdown=frame.drawdown.tolist(),
        returns=frame.return_.tolist(),
    )
    worst = int(frame.drawdown.argmin())
    peak = int(frame["index"].iloc[: worst + 1].argmax())
    recovered = frame.index[(frame.index > worst) & (frame["index"] >= frame["index"].iloc[peak])]
    br = np.diff(benchmark) / benchmark[:-1]
    beta = float(np.cov(returns, br)[0, 1] / np.var(br, ddof=1))
    return dict(
        schema_version="1.0",
        synthetic=True,
        currency="EUR",
        as_of=prices.index[-1],
        value=current,
        cash=float(ledger.cash),
        net_flows=float(ledger.flows),
        daily_pnl=float(frame.value.iloc[-1] - frame.value.iloc[-2] - frame.flow.iloc[-1]),
        all_time_pnl=current - float(ledger.flows),
        realised=float(ledger.realised),
        unrealised=sum(h["unrealised"] for h in holdings),
        income=float(ledger.income),
        fees=float(ledger.fees),
        total_return=float(frame["index"].iloc[-1] - 1),
        benchmark_return=float(benchmark[-1] / benchmark[0] - 1),
        beta=beta,
        concentration=sum(h["weight"] ** 2 for h in holdings) + (float(ledger.cash) / current) ** 2,
        correlations=price_correlations(prices, [h["symbol"] for h in holdings]),
        metrics=metrics,
        holdings=holdings,
        performance=performance,
        worst_date=frame.date.iloc[worst],
        peak_date=frame.date.iloc[peak],
        recovery_date=frame.date.iloc[int(recovered[0])] if len(recovered) else None,
        assumptions=ASSUMPTIONS,
    )


ASSUMPTIONS = [
    "Synthetic EUR equities/ETFs and cash. No live quotes or FX; weekday calendar excludes weekends only.",
    "FIFO analytical cost basis; purchase fees capitalised, sale fees reduce realised gains. Not tax reporting.",
    "Raw synthetic prices; dividends credited separately. Cash earns zero. All external flows start-of-day.",
    "Performance graph: time-weighted wealth rebased to initial EUR capital, not account balance.",
    "Benchmark: synthetic EUR total-return equity index, rebased identically. Not actual S&P 500 data.",
    "Risk: daily simple TWR returns, 252-day annualisation; sample volatility; 2% effective annual risk-free rate.",
    "Sortino: root mean square of negative daily excess returns over all days. VaR: 1-day historical 95% loss boundary.",
    "Simulation: correlated daily log returns, trailing full sample, buy-and-hold units, constant cash, no contributions.",
    "Bootstrap uses joint contiguous 5-day blocks. Pointwise p5/p95 bands are not full-path confidence guarantees.",
    "Worst/best 5% outcomes mean p5/p95 boundaries, not conditional tail means. No calibrated forecasting claim.",
]


class SimulationConfig(BaseModel):
    paths: int = Field(default=10000, ge=100, le=20000)
    horizon: int = Field(default=252, ge=1, le=504)
    seed: int = Field(default=42, ge=0, le=2**32 - 1)
    method: str = Field(default="lognormal", pattern="^(lognormal|bootstrap)$")


@app.post("/api/portfolios/sample/simulation-runs")
def simulation(config: SimulationConfig):
    started_at = datetime.now(timezone.utc).isoformat()
    started = time.perf_counter()
    _, ledger = checked_history()
    pos = ledger.positions()
    quantities = np.array([float(pos.get(s, (0, 0))[0]) for s in SYMBOLS])
    result = simulate(prices.to_numpy(), quantities, float(ledger.cash), **config.model_dump())
    result["dates"] = (
        pd.bdate_range(prices.index[-1], periods=config.horizon + 1).strftime("%Y-%m-%d").tolist()
    )
    result["elapsed_seconds"] = time.perf_counter() - started
    return metadata(config.model_dump(), result, started_at)


@app.post("/api/portfolios/sample/risk-runs")
def risk_run():
    f, _ = checked_history()
    return metadata({"kind": "risk", "rf": 0.02}, risk(f.return_.to_numpy()[1:]))


class ScenarioConfig(BaseModel):
    shock: float = Field(default=-0.2, ge=-1, le=2)
    kind: str = Field(default="fixed", pattern="^(fixed|historical)$")
    start: str = "2025-01-02"
    end: str = "2025-03-31"


@app.post("/api/portfolios/sample/scenario-runs")
def scenario(config: ScenarioConfig):
    f, ledger = checked_history()
    attribution = []
    if config.kind == "historical":
        if config.start not in prices.index or config.end not in prices.index or config.start >= config.end:
            raise HTTPException(422, "Choose two ordered dates on the available weekday calendar")
        shocks = prices.loc[config.end] / prices.loc[config.start] - 1
    else:
        shocks = pd.Series(config.shock, index=SYMBOLS)
    for s, (q, _) in ledger.positions().items():
        attribution.append(dict(symbol=s, change=float(q) * float(prices[s].iloc[-1]) * float(shocks[s])))
    change = sum(a["change"] for a in attribution)
    return metadata(
        config.model_dump(),
        dict(
            change=change,
            value=float(f.value.iloc[-1]) + change,
            return_=change / float(f.value.iloc[-1]),
            attribution=attribution,
        ),
    )


class CSVRequest(BaseModel):
    csv: str = Field(max_length=1_000_000)


@app.post("/api/imports/preview")
def preview(body: CSVRequest):
    checksum = hashlib.sha256(body.csv.encode()).hexdigest()
    reader = csv.DictReader(io.StringIO(body.csv))
    errors, parsed, raw_rows = [], [], []
    for n, row in enumerate(reader, 2):
        if n > 5001:
            errors.append("Maximum 5,000 rows")
            break
        raw_rows.append(row)
        try:
            t = Transaction.model_validate({k: v for k, v in row.items() if v != ""})
            if t.symbol and t.symbol not in SYMBOLS:
                raise ValueError("Unsupported symbol; allowed: " + ", ".join(SYMBOLS))
            parsed.append(t)
        except Exception as e:
            errors.append(f"Row {n}: {e}")
    if not raw_rows:
        errors.append("CSV contains no transaction rows")
    if not errors:
        try:
            value_history(transactions + parsed, prices)
        except ValueError as e:
            errors.append(str(e))
    token = str(uuid4())
    previews[token] = dict(checksum=checksum, parsed=parsed, errors=errors, raw=body.csv)
    return dict(
        id=token,
        rows=[t.model_dump(mode="json") for t in parsed],
        errors=errors,
        duplicate=checksum in committed,
        count=len(parsed),
    )


@app.post("/api/imports/{token}/commit")
def commit(token: str):
    if token not in previews:
        raise HTTPException(404, "Preview expired; preview the file again")
    item = previews[token]
    if item["errors"]:
        raise HTTPException(422, item["errors"])
    if item["checksum"] in committed:
        return dict(status="already_committed", imported=0)
    try:
        value_history(transactions + item["parsed"], prices)
    except ValueError as e:
        raise HTTPException(422, str(e)) from e
    transactions.extend(item["parsed"])
    transaction_file.write_text(json.dumps([t.model_dump(mode="json") for t in transactions]))
    (STATE / f"import-{item['checksum']}.csv").write_text(item["raw"])
    committed[item["checksum"]] = token
    committed_file.write_text(json.dumps(committed))
    return dict(status="committed", imported=len(item["parsed"]))


@app.get("/api/runs/{run_id}")
def get_run(run_id: str):
    if run_id in runs:
        return runs[run_id]
    if len(run_id) != 36 or any(c not in "0123456789abcdef-" for c in run_id):
        raise HTTPException(404, "Unknown run")
    file = STATE / f"{run_id}.json"
    if not file.exists():
        raise HTTPException(404, "Unknown run")
    return json.loads(file.read_text())


@app.get("/api/runs/{run_id}/exports")
def export(run_id: str):
    record = get_run(run_id)
    payload = dict(run=record, overview=record["overview_snapshot"], assumptions=ASSUMPTIONS)
    return Response(
        json.dumps(payload, allow_nan=False, indent=2),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename=portfolio-{run_id}.json"},
    )
