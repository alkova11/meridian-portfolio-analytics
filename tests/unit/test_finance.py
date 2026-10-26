from decimal import Decimal as D

import numpy as np
import pandas as pd
import pytest

from portfolio_analytics.accounting import Transaction, validate_ledger
from portfolio_analytics.analytics import price_correlations, risk, simulate, value_history


def tx(kind, cash=0, q=0, p=0, fee=0):
    return Transaction(
        date="2025-01-02",
        kind=kind,
        symbol="A",
        cash_amount=str(cash),
        quantity=str(q),
        price=str(p),
        fee=str(fee),
    )


def test_hand_reconciled_fifo_split():
    ledger = validate_ledger(
        [
            tx("DEPOSIT", 1000),
            tx("BUY", -200, 10, 20, 2),
            tx("DIVIDEND", 10),
            tx("FEE", -3),
            tx("SPLIT", q=2),
            tx("SELL", 150, 10, 15, 1),
            tx("WITHDRAWAL", -100),
        ]
    )
    assert ledger.cash == D(854)
    assert ledger.positions()["A"] == (D(10), D(101))
    assert ledger.realised == D(48)
    assert ledger.cash + D(150) - ledger.flows == D(104)


def test_oversell_and_cash():
    with pytest.raises(ValueError, match="cannot sell"):
        validate_ledger([tx("SELL", 20, 1, 20)])
    with pytest.raises(ValueError, match="insufficient"):
        validate_ledger([tx("BUY", -20, 1, 20)])


def test_deposit_is_not_return():
    a = tx("DEPOSIT", 100)
    b = a.model_copy(update={"date": pd.Timestamp("2025-01-03").date()})
    f, _ = value_history([a, b], pd.DataFrame({"A": [10.0, 10.0]}, index=["2025-01-02", "2025-01-03"]))
    assert f.value.tolist() == [100, 200]
    assert f.return_.tolist() == [0, 0]


def test_missing_price_rejected():
    with pytest.raises(ValueError, match="Missing"):
        value_history(
            [tx("DEPOSIT", 100), tx("BUY", -20, 1, 20)], pd.DataFrame({"A": [np.nan]}, index=["2025-01-02"])
        )


def test_risk_independent_reference():
    r = np.array([0.1, -0.1, 0.05, -0.02])
    result = risk(r, rf=0)
    assert result["volatility"] == pytest.approx(np.sqrt(sum((r - r.mean()) ** 2) / 3) * np.sqrt(252))
    assert result["max_drawdown"] == pytest.approx(-0.1)
    assert result["var95"] == pytest.approx(0.088)
    assert result["downside_deviation"] == pytest.approx(np.sqrt((0.1**2 + 0.02**2) / 4) * np.sqrt(252))
    assert risk([0, 0, 0])["sharpe"] is None


def test_correlations_inverse_constant_and_held_subset():
    steps = np.array([0.01, -0.02, 0.03, -0.01])
    a = 100 * np.exp(np.r_[0, np.cumsum(steps)])
    prices = pd.DataFrame({"A": a, "B": 10000 / a, "FLAT": np.full(5, 100.0), "UNHELD": a})
    result = price_correlations(prices, ["A", "B", "FLAT"])
    assert set(result) == {"A", "B", "FLAT"}
    assert result["A"]["A"] == pytest.approx(1)
    assert result["A"]["B"] == pytest.approx(-1)
    assert result["B"]["A"] == pytest.approx(-1)
    assert result["FLAT"]["FLAT"] is None
    assert result["A"]["FLAT"] is None
    assert price_correlations(prices, []) == {}


def test_simulation_reproducible_and_zero_vol():
    prices = np.full((80, 2), 100.0)
    a = simulate(prices, np.array([2.0, 3.0]), 10, paths=100, horizon=10)
    assert a == simulate(prices, np.array([2.0, 3.0]), 10, paths=100, horizon=10)
    assert a["expected"] == 510
    assert a["probability_loss"] == 0
    assert np.all(np.diff(a["quantiles"], axis=0) >= 0)


def test_dividend_and_split_do_not_double_count():
    from datetime import date

    transactions = [tx("DEPOSIT", 1000), tx("BUY", -200, 10, 20)]
    split = tx("SPLIT", q=2).model_copy(update={"date": date(2025, 1, 3)})
    dividend = tx("DIVIDEND", 20).model_copy(update={"date": date(2025, 1, 6)})
    prices = pd.DataFrame({"A": [20.0, 10.0, 10.0]}, index=["2025-01-02", "2025-01-03", "2025-01-06"])
    f, ledger = value_history(transactions + [split, dividend], prices)
    assert f.value.tolist() == [1000, 1000, 1020]
    assert f.return_.to_numpy() == pytest.approx([0, 0, 0.02])
    assert ledger.positions()["A"] == (D(20), D(200))


def test_simulation_cash_reduces_relative_risk():
    p = np.exp(np.linspace(0, 0.03, 100)[:, None] + np.random.default_rng(1).normal(0, 0.01, (100, 1))) * 100
    risky = simulate(p, np.array([1.0]), 0, paths=300, horizon=25)
    cash = simulate(p, np.array([1.0]), 100, paths=300, horizon=25)
    assert cash["expected"] == pytest.approx(risky["expected"] + 100)
    assert cash["p95"] - cash["p5"] == pytest.approx(risky["p95"] - risky["p5"])
    assert cash["expected_return"] < risky["expected_return"]


def test_fifo_multiple_lots_and_fee_basis():
    ledger = validate_ledger(
        [tx("DEPOSIT", 1000), tx("BUY", -100, 10, 10, 2), tx("BUY", -200, 10, 20), tx("SELL", 225, 15, 15, 1)]
    )
    assert ledger.positions()["A"] == (D(5), D(100))
    assert ledger.realised == D(22)
