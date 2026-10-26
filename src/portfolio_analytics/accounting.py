from collections import defaultdict, deque
from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

D = Decimal


class Transaction(BaseModel):
    model_config = ConfigDict(extra="forbid")
    date: date
    kind: Literal["BUY", "SELL", "DEPOSIT", "WITHDRAWAL", "DIVIDEND", "FEE", "SPLIT"]
    symbol: str = ""
    quantity: Decimal = Field(default=D(0), ge=0, allow_inf_nan=False)
    price: Decimal = Field(default=D(0), ge=0, allow_inf_nan=False)
    cash_amount: Decimal = Field(default=D(0), allow_inf_nan=False)
    fee: Decimal = Field(default=D(0), ge=0, allow_inf_nan=False)
    currency: Literal["EUR"] = "EUR"

    @model_validator(mode="after")
    def signs(self):
        if self.kind in ("BUY", "SELL", "SPLIT") and (not self.symbol or self.quantity <= 0):
            raise ValueError("Trade/split requires a symbol and positive quantity (split ratio)")
        if self.kind in ("BUY", "SELL"):
            if self.price <= 0:
                raise ValueError("Trade price must be positive")
            expected = self.quantity * self.price * (-1 if self.kind == "BUY" else 1)
            if self.cash_amount != expected:
                raise ValueError(f"Gross cash_amount must equal {expected}; fee is deducted separately")
        elif self.kind == "SPLIT":
            if self.cash_amount or self.fee or self.price:
                raise ValueError("Split must have zero price, cash and fee")
        else:
            if self.quantity or self.price:
                raise ValueError("Cash events must have zero quantity and price")
            if self.kind in ("DEPOSIT", "DIVIDEND") and self.cash_amount <= 0:
                raise ValueError("Deposit/dividend cash must be positive")
            if self.kind in ("WITHDRAWAL", "FEE") and self.cash_amount >= 0:
                raise ValueError("Withdrawal/fee cash must be negative")
            if self.kind == "FEE" and self.fee:
                raise ValueError("Use negative cash_amount for a standalone fee; do not duplicate it")
        return self


class Ledger:
    def __init__(self):
        self.cash = D(0)
        self.lots = defaultdict(deque)
        self.realised = D(0)
        self.flows = D(0)
        self.income = D(0)
        self.fees = D(0)

    def apply(self, t: Transaction):
        lots = self.lots[t.symbol]
        if t.kind == "SELL" and t.quantity > sum((q for q, _ in lots), D(0)):
            raise ValueError(f"{t.date}: cannot sell more {t.symbol} than held")
        if self.cash + t.cash_amount - t.fee < 0:
            raise ValueError(f"{t.date}: insufficient EUR cash")
        if t.kind == "BUY":
            lots.append([t.quantity, -t.cash_amount + t.fee])
        elif t.kind == "SELL":
            remaining, basis = t.quantity, D(0)
            while remaining:
                q, cost = lots[0]
                take = min(remaining, q)
                removed = cost * take / q
                basis += removed
                remaining -= take
                if take == q:
                    lots.popleft()
                else:
                    lots[0] = [q - take, cost - removed]
            self.realised += t.cash_amount - t.fee - basis
        elif t.kind == "SPLIT":
            for lot in lots:
                lot[0] *= t.quantity
        elif t.kind in ("DEPOSIT", "WITHDRAWAL"):
            self.flows += t.cash_amount
        elif t.kind == "DIVIDEND":
            self.income += t.cash_amount
        self.fees += t.fee + (-t.cash_amount if t.kind == "FEE" else D(0))
        self.cash += t.cash_amount - t.fee

    def positions(self):
        return {
            s: (sum((x[0] for x in lots), D(0)), sum((x[1] for x in lots), D(0)))
            for s, lots in self.lots.items()
            if lots
        }


def validate_ledger(transactions):
    ledger = Ledger()
    for t in sorted(transactions, key=lambda x: x.date):
        ledger.apply(t)
    return ledger
