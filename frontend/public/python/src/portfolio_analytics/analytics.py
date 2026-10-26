import numpy as np
import pandas as pd

from .accounting import Ledger


def price_correlations(prices, symbols):
    """Pearson correlations of aligned daily log raw-price returns; undefined is null."""
    if not symbols:
        return {}
    marks = prices.loc[:, symbols]
    if not np.isfinite(marks.to_numpy()).all() or (marks.to_numpy() <= 0).any():
        raise ValueError("Correlation requires complete positive prices")
    daily = pd.DataFrame(np.diff(np.log(marks), axis=0), columns=symbols)
    matrix = daily.corr()
    return matrix.astype(object).where(matrix.notna(), None).to_dict()


def risk(returns, rf=0.02):
    r = np.asarray(returns, dtype=float)
    if len(r) < 2 or not np.isfinite(r).all():
        raise ValueError("At least two finite daily returns required")
    excess = r - np.expm1(np.log1p(rf) / 252)
    vol = float(r.std(ddof=1) * np.sqrt(252))
    downside = float(np.sqrt(np.mean(np.minimum(excess, 0) ** 2)) * np.sqrt(252))
    wealth = np.r_[1.0, np.cumprod(1 + r)]
    dd = wealth / np.maximum.accumulate(wealth) - 1
    return dict(
        volatility=vol,
        downside_deviation=downside,
        sharpe=float(excess.mean() * 252 / vol) if vol > 1e-12 else None,
        sortino=float(excess.mean() * 252 / downside) if downside > 1e-12 else None,
        max_drawdown=float(dd.min()),
        var95=float(max(0, -np.quantile(r, 0.05))),
        observations=len(r),
        risk_free_rate=rf,
    )


def value_history(transactions, prices):
    ledger, rows, previous = Ledger(), [], 0.0
    tx = sorted(transactions, key=lambda t: t.date)
    if any(t.date.isoformat() not in prices.index for t in tx):
        raise ValueError("Every transaction date must be in the supplied valuation calendar")
    for day, marks in prices.iterrows():
        flow = 0.0
        for t in tx:
            if t.date.isoformat() == day:
                ledger.apply(t)
                if t.kind in ("DEPOSIT", "WITHDRAWAL"):
                    flow += float(t.cash_amount)
        holdings = ledger.positions()
        for s in holdings:
            if s not in marks or pd.isna(marks[s]) or marks[s] <= 0:
                raise ValueError(f"Missing or invalid price: {s} on {day}; valuation incomplete")
        value = float(ledger.cash) + sum(float(q) * float(marks[s]) for s, (q, _) in holdings.items())
        # External flows occur before that day's returns. Zero capital days carry no return.
        denominator = previous + flow
        if denominator < 0 or (denominator == 0 and value != 0):
            raise ValueError("Invalid opening capital after start-of-day flow")
        ret = value / denominator - 1 if denominator else 0.0
        rows.append(dict(date=day, value=value, cash=float(ledger.cash), flow=flow, return_=ret))
        previous = value
    frame = pd.DataFrame(rows)
    frame["index"] = (1 + frame.return_).cumprod()
    frame["drawdown"] = frame["index"] / frame["index"].cummax() - 1
    return frame, ledger


def simulate(prices, quantities, cash, paths=10000, horizon=252, seed=42, method="lognormal"):
    if paths < 100 or paths > 20000 or horizon < 1 or horizon > 504:
        raise ValueError("Paths 100–20,000; horizon 1–504")
    logret = np.diff(np.log(prices), axis=0)
    if len(logret) < 60 or not np.isfinite(logret).all():
        raise ValueError("Simulation requires at least 61 complete positive price observations")
    rng = np.random.default_rng(seed)
    covariance = np.atleast_2d(np.cov(logret, rowvar=False))
    if np.linalg.eigvalsh(covariance).min() < -1e-10:
        raise ValueError("Invalid covariance")
    asset = np.broadcast_to(prices[-1], (paths, prices.shape[1])).copy()
    values = np.empty((paths, horizon + 1))
    values[:, 0] = asset @ quantities + cash
    if method == "bootstrap":
        starts = rng.integers(0, len(logret) - 4, size=(paths, (horizon + 4) // 5))
    for day in range(horizon):
        shocks = (
            logret[starts[:, day // 5] + day % 5]
            if method == "bootstrap"
            else rng.multivariate_normal(logret.mean(axis=0), covariance, size=paths)
        )
        asset *= np.exp(shocks)
        values[:, day + 1] = asset @ quantities + cash
    quantiles = np.quantile(values, [0.05, 0.25, 0.5, 0.75, 0.95], axis=0)
    terminal = values[:, -1]
    counts, edges = np.histogram(terminal, bins=32)
    return dict(
        quantiles=quantiles.tolist(),
        histogram=dict(counts=counts.tolist(), edges=edges.tolist()),
        expected=float(terminal.mean()),
        median=float(np.median(terminal)),
        expected_return=float(terminal.mean() / values[0, 0] - 1),
        probability_loss=float(np.mean(terminal < values[0, 0])),
        p5=float(quantiles[0, -1]),
        p95=float(quantiles[-1, -1]),
        seed=seed,
        paths=paths,
        horizon=horizon,
        method=method,
    )
