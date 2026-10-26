from pathlib import Path

import numpy as np
import pandas as pd

from .accounting import Transaction

SYMBOLS = ["EQUA", "TECH", "EURO", "BOND", "GOLD"]
NAMES = ["Global Equity ETF", "Technology Equity ETF", "Europe Equity ETF", "EUR Bond ETF", "Gold Equity ETF"]
SECTORS = ["Global equity", "Technology", "European equity", "Fixed income", "Gold miners"]
ROOT = Path(__file__).resolve().parents[2]


def sample():
    rng = np.random.default_rng(73)
    dates = pd.bdate_range("2024-10-25", "2026-10-23")
    common = rng.normal(0.0003, 0.007, len(dates) - 1)
    r = common[:, None] * np.array([1, 1.45, 0.85, 0.08, 0.35]) + rng.normal(
        [0.0001, 0.0003, 0, 0.00008, 0.0001], [0.003, 0.006, 0.004, 0.002, 0.009], (len(dates) - 1, 5)
    )
    prices = np.vstack(
        [np.array([100, 150, 80, 100, 60]), np.array([100, 150, 80, 100, 60]) * np.exp(r.cumsum(axis=0))]
    )
    frame = pd.DataFrame(prices, index=dates.strftime("%Y-%m-%d"), columns=SYMBOLS)
    benchmark = np.r_[100, 100 * np.exp(np.cumsum(common + 0.0001))]
    tx = [Transaction(date=dates[0].date(), kind="DEPOSIT", cash_amount="100000")]
    for s, q in zip(SYMBOLS, [350, 150, 200, 100, 100]):
        p = str(frame.iloc[0][s])
        tx.append(
            Transaction(
                date=dates[0].date(),
                kind="BUY",
                symbol=s,
                quantity=str(q),
                price=p,
                cash_amount=str(-q * float(p)),
                fee="2",
            )
        )
    tx += [
        Transaction(date=dates[252].date(), kind="DEPOSIT", cash_amount="10000"),
        Transaction(date=dates[300].date(), kind="DIVIDEND", symbol="EQUA", cash_amount="540"),
    ]
    return frame, benchmark, tx
