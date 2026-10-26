import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { loadPyodide } from "../frontend/node_modules/pyodide/pyodide.mjs";
import { initializePython } from "../frontend/public/python-engine.mjs";
async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const runtime = await initializePython({
    loadPyodide,
    readText: (p) => readFile(path.join(root, "frontend/public", p), "utf8"),
    options: { packageCacheDir: path.join(root, "frontend/.pyodide-cache") },
    status: (message) => {
      if (message) console.log(message);
    },
  });
  const cached = JSON.parse(
    await readFile(
      path.join(root, "frontend/public/demo-bootstrap.json"),
      "utf8",
    ),
  );
  const overview = await runtime.dispatch("/portfolios/sample/overview");
  assert.ok(Math.abs(overview.value - cached.overview.value) < 1e-6);
  assert.ok(
    Math.abs(overview.metrics.volatility - cached.overview.metrics.volatility) <
      1e-10,
  );
  const config = { paths: 100, horizon: 5, seed: 99, method: "bootstrap" };
  const first = await runtime.dispatch(
    "/portfolios/sample/simulation-runs",
    config,
  );
  const second = await runtime.dispatch(
    "/portfolios/sample/simulation-runs",
    config,
  );
  assert.deepEqual(first.result.quantiles, second.result.quantiles);
  const normal = await runtime.dispatch("/portfolios/sample/simulation-runs", {
    paths: 100,
    horizon: 5,
    seed: 91,
    method: "lognormal",
  });
  assert.equal(normal.result.quantiles.length, 5);
  assert.ok(
    normal.result.p95 >= normal.result.median &&
      normal.result.median >= normal.result.p5,
  );
  const scenario = await runtime.dispatch("/portfolios/sample/scenario-runs", {
    kind: "fixed",
    shock: -0.2,
  });
  assert.ok(scenario.result.change < 0);
  const preview = await runtime.dispatch("/imports/preview", {
    csv: "date,kind,symbol,quantity,price,cash_amount,fee,currency\n2026-10-23,DEPOSIT,,0,0,1000,0,EUR",
  });
  assert.deepEqual(preview.errors, []);
  const commit = await runtime.dispatch(`/imports/${preview.id}/commit`, {});
  assert.equal(commit.imported, 1);
  assert.equal(
    (await runtime.dispatch(`/imports/${preview.id}/commit`, {})).imported,
    0,
  );
  const updated = await runtime.dispatch("/portfolios/sample/overview");
  assert.ok(Math.abs(updated.value - overview.value - 1000) < 1e-6);
  assert.ok(Math.abs(updated.all_time_pnl - overview.all_time_pnl) < 1e-6);
  assert.equal(
    (await runtime.dispatch(`/runs/${first.run_id}/exports`)).run.run_id,
    first.run_id,
  );
  console.log(
    "Public Python runtime checks passed: valuation, risk parity, seeded bootstrap, scenarios, imports, idempotence, cash-flow neutrality and exports.",
  );
}
main().catch((error) => {
  console.error(error?.message || String(error));
  process.exitCode = 1;
});
