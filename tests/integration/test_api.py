from fastapi.testclient import TestClient

from backend.app import main

client = TestClient(main.app)


def test_overview_and_export():
    data = client.get("/api/portfolios/sample/overview").json()
    assert data["synthetic"]
    assert data["metrics"]["downside_deviation"] > 0
    assert set(data["correlations"]) == {h["symbol"] for h in data["holdings"]}
    assert abs(data["value"] - data["cash"] - sum(h["value"] for h in data["holdings"])) < 1e-8
    run = client.post("/api/portfolios/sample/simulation-runs", json={"paths": 100, "horizon": 10}).json()
    assert len(run["result"]["dates"]) == 11
    assert client.get(f"/api/runs/{run['run_id']}/exports").status_code == 200
    assert run["transaction_snapshot"]


def test_import_preview_commit_idempotent(tmp_path, monkeypatch):
    monkeypatch.setattr(main, "transactions", list(main.sample_tx))
    monkeypatch.setattr(main, "committed", {})
    monkeypatch.setattr(main, "STATE", tmp_path)
    monkeypatch.setattr(main, "transaction_file", tmp_path / "transactions.json")
    monkeypatch.setattr(main, "committed_file", tmp_path / "committed.json")
    csv = "date,kind,symbol,quantity,price,cash_amount,fee,currency\n2026-10-23,DEPOSIT,,0,0,1000,0,EUR"
    preview = client.post("/api/imports/preview", json={"csv": csv}).json()
    assert not preview["errors"]
    uri = f"/api/imports/{preview['id']}/commit"
    assert client.post(uri).json()["imported"] == 1
    assert client.post(uri).json()["imported"] == 0


def test_invalid_import_and_scenario():
    preview = client.post("/api/imports/preview", json={"csv": "date,kind\n2026-10-24,BUY"}).json()
    assert preview["errors"]
    assert client.post(f"/api/imports/{preview['id']}/commit").status_code == 422
    scenario = client.post("/api/portfolios/sample/scenario-runs", json={"shock": -0.2}).json()
    assert scenario["result"]["change"] < 0


def test_export_uses_frozen_overview(monkeypatch):
    run = client.post("/api/portfolios/sample/simulation-runs", json={"paths": 100, "horizon": 2}).json()
    frozen = run["overview_snapshot"]["value"]
    monkeypatch.setattr(main, "overview", lambda: {"value": -1})
    exported = client.get(f"/api/runs/{run['run_id']}/exports").json()
    assert exported["overview"]["value"] == frozen


def test_simulation_bounds_and_quantile_order():
    assert client.post("/api/portfolios/sample/simulation-runs", json={"paths": 100000}).status_code == 422
    run = client.post(
        "/api/portfolios/sample/simulation-runs", json={"paths": 100, "horizon": 10, "method": "bootstrap"}
    ).json()
    import numpy as np

    assert (np.diff(run["result"]["quantiles"], axis=0) >= 0).all()
    assert run["started_at"] <= run["finished_at"]


def test_undefined_correlation_is_json_null(monkeypatch):
    monkeypatch.setattr(main, "prices", main.prices.assign(EQUA=100.0))
    response = client.get("/api/portfolios/sample/overview")
    assert response.status_code == 200
    assert response.json()["correlations"]["EQUA"]["EQUA"] is None
    assert response.json()["correlations"]["TECH"]["EQUA"] is None
