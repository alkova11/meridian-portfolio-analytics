import { PublicBanner } from "../public/PublicBanner";
import { RiskAnalysis } from "./components/RiskAnalysis";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { InspectChart, Plot, Spark, Donut, base } from "./charts/Charts";
import {
  api,
  colors,
  euro,
  number,
  pct,
  signed,
  downloadAnalysis,
} from "./lib";
import type { Overview, Simulation } from "./types";
import "./style.css";

function App() {
  const [data, setData] = useState<Overview | null>(null);
  const [sim, setSim] = useState<Simulation | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("Overview");
  const [pi, setPi] = useState<number | null>(null);
  const [di, setDi] = useState<number | null>(null);
  const [period, setPeriod] = useState("ALL");
  const [configure, setConfigure] = useState(false);
  const [paths, setPaths] = useState(10000);
  const [horizon, setHorizon] = useState(252);
  const [seed, setSeed] = useState(42);
  const [method, setMethod] = useState("lognormal");
  const [preview, setPreview] = useState<{
    id: string;
    rows: Record<string, string>[];
    errors: string[];
    duplicate: boolean;
    count: number;
  } | null>(null);
  const [notice, setNotice] = useState("");
  const [scenario, setScenario] = useState<{
    change: number;
    value: number;
    return_: number;
  } | null>(null);
  const [shock, setShock] = useState(-20);
  const [scenarioKind, setScenarioKind] = useState("fixed");
  const refresh = async () => setData(await api("/portfolios/sample/overview"));
  const run = async () => {
    setBusy(true);
    setError("");
    try {
      setSim(
        await api("/portfolios/sample/simulation-runs", {
          paths,
          horizon,
          seed,
          method,
        }),
      );
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    void refresh().catch((e) => setError(String(e)));
    void run();
  }, []);
  if (!data)
    return (
      <div className="loading">
        <span className="terminal-logo">▥</span>
        <h2>PORTFOLIO ANALYTICS</h2>
        <p>{error || "Reconciling ledger / calculating analytics…"}</p>
      </div>
    );
  const d = data,
    p = d.performance,
    s = sim?.result;
  const start =
    period === "1Y"
      ? Math.max(0, p.dates.length - 253)
      : period === "3M"
        ? Math.max(0, p.dates.length - 64)
        : period === "1M"
          ? Math.max(0, p.dates.length - 22)
          : 0;
  const dates = p.dates.slice(start),
    si = pi === null ? p.dates.length - 1 : pi + start,
    dd = di === null ? p.dates.length - 1 : di;
  const daily = p.values.slice(1).map((v, i) => v / p.values[i] - 1);
  const best = daily.indexOf(Math.max(...daily)),
    worst = daily.indexOf(Math.min(...daily));
  const positiveDays = daily.filter((v) => v > 0).length / daily.length;
  const handleFile = async (file: File) => {
    try {
      if (file.size > 1000000) throw Error("CSV must be smaller than 1 MB");
      setPreview(await api("/imports/preview", { csv: await file.text() }));
      setNotice("");
    } catch (e) {
      setError(String(e));
    }
  };
  return (
    <main className="terminal">
      {import.meta.env.VITE_PUBLIC_DEMO === "true" && <PublicBanner />}
      <header className="portfolio-header">
        <div className="identity">
          <button
            className="identity-button"
            onClick={() => setTab("Overview")}
          >
            PORTFOLIO ANALYTICS
          </button>
          <span>{d.holdings.length} holdings · EUR portfolio</span>
          <span className="synthetic-label">SYNTHETIC DATA</span>
        </div>
        <nav aria-label="Workspace">
          <button
            className={tab === "Overview" ? "selected" : ""}
            onClick={() => setTab("Overview")}
          >
            Overview
          </button>
          <button
            className={tab === "Transactions" ? "selected" : ""}
            onClick={() => setTab("Transactions")}
          >
            Transactions
          </button>
          <button
            className={tab === "Scenarios" ? "selected" : ""}
            onClick={() => setTab("Scenarios")}
          >
            Scenarios
          </button>
          <button
            className={tab === "Methodology" ? "selected" : ""}
            onClick={() => setTab("Methodology")}
          >
            Methods
          </button>
          <a href="/">Custom dashboard ↗</a>
        </nav>
        <div className="portfolio-total">
          <span className="big-value">{number(d.value)}</span>
          <span className="currency">EUR</span>
          <span className="total-caption">NET PORTFOLIO VALUE</span>
        </div>
        <div className="headline-pnl">
          <span>
            <label>TODAY</label>
            <b className={d.daily_pnl >= 0 ? "positive" : "negative"}>
              {signed(d.daily_pnl)}{" "}
              <small>({pct(d.daily_pnl / (d.value - d.daily_pnl))})</small>
            </b>
          </span>
          <span>
            <label>ALL TIME</label>
            <b className={d.all_time_pnl >= 0 ? "positive" : "negative"}>
              {signed(d.all_time_pnl)}{" "}
              <small>({pct(d.total_return)} TWR)</small>
            </b>
          </span>
          <span>
            <label>UNREALISED P&L</label>
            <b className={d.unrealised >= 0 ? "positive" : "negative"}>
              {signed(d.unrealised)}
            </b>
          </span>
        </div>
        <div className="header-history">
          <Spark
            values={p.values.slice(-100)}
            width={190}
            height={39}
            color="#638676"
          />
          <div>
            {p.dates[0]} — {d.as_of}
            <a
              href={sim ? `/api/runs/${sim.run_id}/exports` : undefined}
              onClick={(event) => downloadAnalysis(event, sim?.run_id)}
              download
            >
              ↓ EXPORT
            </a>
          </div>
        </div>
      </header>
      {error && (
        <div className="error" role="alert">
          {error}
          <button onClick={() => setError("")}>Dismiss</button>
        </div>
      )}
      {tab === "Overview" && (
        <>
          <section className="metrics" aria-label="Risk metrics">
            {[
              [
                "VOLATILITY",
                pct(d.metrics.volatility),
                "Annualised · daily returns",
              ],
              [
                "SHARPE",
                d.metrics.sharpe?.toFixed(2) ?? "—",
                "Excess return / total risk",
              ],
              [
                "SORTINO",
                d.metrics.sortino?.toFixed(2) ?? "—",
                "Excess return / downside",
              ],
              [
                "MAX DRAWDOWN",
                pct(d.metrics.max_drawdown),
                "Peak-to-trough · TWR",
              ],
              [
                "VaR 95%",
                `${number(d.metrics.var95 * d.value)} EUR`,
                "1-day historical loss",
              ],
              [
                "BETA vs BENCHMARK",
                d.beta.toFixed(2),
                "Synthetic EUR equity index",
              ],
              [
                "PORTFOLIO RETURN",
                pct(d.total_return),
                "Cash-flow-neutral · all time",
              ],
              [
                s ? `MEDIAN / ${s.horizon} DAYS` : "MEDIAN / SIMULATION",
                s ? `${number(s.median)} EUR` : "…",
                "Conditional model outcome",
              ],
            ].map(([label, value, sub]) => (
              <div key={label}>
                <label>{label}</label>
                <strong>{value}</strong>
                <small>{sub}</small>
              </div>
            ))}
          </section>
          <section className="upper-grid">
            <div className="performance-panel panel">
              <div className="panel-heading">
                <h2>
                  PERFORMANCE <span>EUR / TIME-WEIGHTED WEALTH</span>
                </h2>
                <div className="period">
                  {["1M", "3M", "1Y", "ALL"].map((t) => (
                    <button
                      className={period === t ? "selected" : ""}
                      key={t}
                      onClick={() => {
                        setPeriod(t);
                        setPi(null);
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="chart-readout" aria-live="polite">
                <time>{p.dates[si]}</time>
                <span className="blue">
                  <i />
                  Portfolio <b>{number(p.values[si])}</b>
                </span>
                <span className="benchmark">
                  <i />
                  Benchmark <b>{number(p.benchmark[si])}</b>
                </span>
              </div>
              <InspectChart
                kind="performance"
                dates={dates}
                series={[
                  {
                    values: p.values.slice(start),
                    color: "#7fa4d9",
                    name: "Portfolio",
                  },
                  {
                    values: p.benchmark.slice(start),
                    color: "#444b50",
                    name: "Benchmark",
                  },
                ]}
                onSelect={setPi}
              />
              <div className="period-returns">
                {[
                  ["1D", 1],
                  ["1W", 5],
                  ["1M", 21],
                  ["3M", 63],
                  ["1Y", 252],
                  ["ALL", p.values.length - 1],
                ].map(([label, observations]) => {
                  const i = Math.max(
                    0,
                    p.values.length - 1 - Number(observations),
                  );
                  const capital =
                    label === "ALL"
                      ? p.values[0] / (1 + p.returns[0])
                      : p.values[i];
                  const gain = p.values.at(-1)! - capital,
                    ret = p.values.at(-1)! / capital - 1;
                  return (
                    <div key={label}>
                      <label>{label}</label>
                      <b className={ret >= 0 ? "positive" : "negative"}>
                        {ret >= 0 ? "+" : ""}
                        {pct(ret)}
                      </b>
                      <small>{signed(gain)}</small>
                    </div>
                  );
                })}
              </div>
              <div className="performance-notes">
                <span>
                  OBSERVATIONS <b>{daily.length}</b>
                </span>
                <span>
                  POSITIVE DAYS <b>{pct(positiveDays)}</b>
                </span>
                <span>
                  BEST DAY <b className="positive">{pct(daily[best])}</b>{" "}
                  {p.dates[best + 1]}
                </span>
                <span>
                  WORST DAY <b className="negative">{pct(daily[worst])}</b>{" "}
                  {p.dates[worst + 1]}
                </span>
              </div>
            </div>
            <aside className="allocations panel">
              <div className="panel-heading">
                <h2>
                  ALLOCATION <span>EUR</span>
                </h2>
              </div>
              <Donut
                title="ASSET CLASS"
                labels={["Equity ETFs", "Bond ETF", "Cash"]}
                values={[
                  d.holdings
                    .filter((h) => h.symbol !== "BOND")
                    .reduce((a, h) => a + h.value, 0),
                  d.holdings.find((h) => h.symbol === "BOND")?.value || 0,
                  d.cash,
                ]}
              />
              <Donut
                title="HOLDINGS"
                labels={[...d.holdings.map((h) => h.symbol), "Cash"]}
                values={[...d.holdings.map((h) => h.value), d.cash]}
              />
            </aside>
          </section>
          <section className="lower-grid">
            <div className="panel drawdown-panel">
              <div className="panel-heading">
                <h2>
                  DRAWDOWN <span>FROM RUNNING PEAK</span>
                </h2>
              </div>
              <div className="drawdown-readout">
                <span>
                  {di === null ? "CURRENT" : p.dates[dd]}{" "}
                  <b className="negative">{pct(p.drawdown[dd])}</b>
                </span>
                <span>
                  WORST{" "}
                  <b className="negative">{pct(d.metrics.max_drawdown)}</b>{" "}
                  {d.worst_date}
                </span>
              </div>
              <div className="recovery-note">
                PEAK {d.peak_date} <span>·</span> RECOVERY{" "}
                {d.recovery_date || "NOT YET RECOVERED"}
              </div>
              <InspectChart
                dates={p.dates}
                kind="drawdown"
                series={[
                  { values: p.drawdown, color: "#bb5860", name: "Drawdown" },
                ]}
                onSelect={setDi}
              />
            </div>
            <div className="panel simulation-panel">
              <div className="panel-heading">
                <h2>
                  MONTE CARLO{" "}
                  <span>
                    {s
                      ? `${s.paths.toLocaleString()} paths · ${s.horizon} trading days`
                      : "COMPUTING"}
                  </span>
                </h2>
                <button
                  className="configure-button"
                  onClick={() => setConfigure(!configure)}
                  aria-expanded={configure}
                >
                  CONFIG {configure ? "−" : "+"}
                </button>
              </div>
              {configure && (
                <div className="simulation-controls">
                  <label>
                    PATHS
                    <input
                      aria-label="Simulation paths"
                      type="number"
                      min="100"
                      max="20000"
                      value={paths}
                      onChange={(e) => setPaths(+e.target.value)}
                    />
                  </label>
                  <label>
                    DAYS
                    <input
                      aria-label="Simulation days"
                      type="number"
                      min="1"
                      max="504"
                      value={horizon}
                      onChange={(e) => setHorizon(+e.target.value)}
                    />
                  </label>
                  <label>
                    SEED
                    <input
                      aria-label="Simulation seed"
                      type="number"
                      value={seed}
                      onChange={(e) => setSeed(+e.target.value)}
                    />
                  </label>
                  <select
                    aria-label="Simulation model"
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                  >
                    <option value="lognormal">Lognormal</option>
                    <option value="bootstrap">Block bootstrap</option>
                  </select>
                  <button disabled={busy} onClick={() => void run()}>
                    {busy ? "RUNNING…" : "RUN ↗"}
                  </button>
                </div>
              )}
              <div className="fan-legend">
                <span>
                  <i className="outer-band" />
                  5th–95th percentile
                </span>
                <span>
                  <i className="inner-band" />
                  25th–75th percentile
                </span>
                <span>
                  <i className="median-line" />
                  Median
                </span>
              </div>
              {s && (
                <InspectChart
                  dates={s.dates}
                  kind="fan"
                  series={s.quantiles.map((values, i) => ({
                    values,
                    color: [
                      "#668bc1",
                      "#83a6db",
                      "#bed2ef",
                      "#83a6db",
                      "#668bc1",
                    ][i],
                    name: ["p5", "p25", "p50", "p75", "p95"][i],
                  }))}
                />
              )}
              <div className="simulation-note">
                {s?.method === "bootstrap"
                  ? "JOINT 5-DAY BLOCK BOOTSTRAP"
                  : "MULTIVARIATE LOGNORMAL"}{" "}
                <span>·</span> BUY & HOLD <span>·</span> NO CONTRIBUTIONS
              </div>
            </div>
            <aside className="panel terminal-panel">
              <div className="panel-heading">
                <h2>
                  OUTCOME <span>TERMINAL VALUE, EUR</span>
                </h2>
              </div>
              {s && (
                <>
                  <Plot
                    className="histogram"
                    traces={[
                      {
                        type: "bar",
                        x: s.histogram.edges
                          .slice(0, -1)
                          .map((v, i) => (v + s.histogram.edges[i + 1]) / 2),
                        y: s.histogram.counts,
                        marker: {
                          color: "#507dbb",
                          line: { color: "#83a4d2", width: 0.2 },
                        },
                      },
                    ]}
                    layout={{
                      margin: { l: 4, r: 4, t: 16, b: 24 },
                      xaxis: {
                        ...base.xaxis,
                        nticks: 3,
                        showgrid: false,
                        tickformat: "~s",
                      },
                      yaxis: { visible: false },
                      bargap: 0.04,
                    }}
                  />
                  <dl>
                    {[
                      ["Expected", euro(s.expected)],
                      ["Median (p50)", euro(s.median)],
                      ["Expected return", pct(s.expected_return)],
                      ["P(loss)", pct(s.probability_loss)],
                      ["Lower 5% (p5)", euro(s.p5)],
                      ["Upper 5% (p95)", euro(s.p95)],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="model-note">
                    Conditional scenarios, not forecasts. Bands are pointwise.
                    Cash held constant; future dividends excluded.
                  </p>
                  <div className="run-meta">
                    SEED {s.seed} <span>·</span> RUN {sim?.run_id.slice(0, 8)}
                  </div>
                </>
              )}
            </aside>
          </section>
          <section className="holdings panel">
            <div className="panel-heading">
              <h2>
                HOLDINGS <span>{d.holdings.length} POSITIONS / EUR</span>
              </h2>
              <span className="table-note">
                Cash {euro(d.cash)} · FIFO analytical basis
              </span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {[
                      "ASSET",
                      "QUANTITY",
                      "PRICE",
                      "VALUE",
                      "WEIGHT",
                      "TODAY",
                      "UNREALISED P&L",
                      "50 OBSERVATIONS",
                    ].map((label) => (
                      <th key={label}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {d.holdings.map((h, i) => (
                    <tr key={h.symbol}>
                      <td>
                        <span className="asset-ticker">
                          <i style={{ background: colors[i] }} />
                          <b>{h.symbol}</b>
                        </span>
                        <small className="asset-name">{h.name}</small>
                      </td>
                      <td>{h.quantity.toLocaleString()}</td>
                      <td>{euro(h.price)}</td>
                      <td>{euro(h.value)}</td>
                      <td>{pct(h.weight)}</td>
                      <td className={h.daily >= 0 ? "positive" : "negative"}>
                        {pct(h.daily)}
                      </td>
                      <td
                        className={h.unrealised >= 0 ? "positive" : "negative"}
                      >
                        {signed(h.unrealised)}
                      </td>
                      <td>
                        <Spark
                          values={h.spark}
                          color={h.daily >= 0 ? "#648b7a" : "#a55d64"}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <RiskAnalysis data={d} />
        </>
      )}
      {tab === "Transactions" && (
        <section className="panel workspace-panel">
          <h2>Transaction import</h2>
          <p>
            Preview and validate before committing to the local portfolio. EUR
            only. Cash amounts are signed gross flows; fees are deducted
            separately.
          </p>
          <p>
            Supported symbols: {d.holdings.map((h) => h.symbol).join(", ")}.
            Dates must fall on the supplied 2024-10-25–2026-10-23 weekday
            calendar.
          </p>
          <pre>
            date,kind,symbol,quantity,price,cash_amount,fee,currency{"\n"}
            2026-10-23,DEPOSIT,,0,0,1000,0,EUR
          </pre>
          <label className="file-input">
            Choose transaction CSV
            <input
              aria-label="Transaction CSV"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) =>
                e.target.files?.[0] && handleFile(e.target.files[0])
              }
            />
          </label>
          {preview && (
            <>
              <h3>
                {preview.count} validated rows{" "}
                {preview.duplicate ? "· already imported" : ""}
              </h3>
              {preview.errors.length > 0 ? (
                <div className="error">
                  {preview.errors.map((e, i) => (
                    <p key={i}>{e}</p>
                  ))}
                </div>
              ) : (
                <p className="positive">
                  Ledger validation passed. No negative cash or overselling.
                </p>
              )}
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      {Object.keys(preview.rows[0] || {}).map((k) => (
                        <th key={k}>{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.slice(0, 20).map((row, i) => (
                      <tr key={i}>
                        {Object.values(row).map((v, j) => (
                          <td key={j}>{v}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                disabled={!!preview.errors.length || preview.duplicate}
                className="primary"
                onClick={async () => {
                  try {
                    const r = await api(`/imports/${preview.id}/commit`, {});
                    setNotice(`${r.imported} rows imported`);
                    setPreview(null);
                    await refresh();
                    await run();
                  } catch (e) {
                    setError(String(e));
                  }
                }}
              >
                Commit import
              </button>
            </>
          )}
          {notice && <p role="status">{notice}</p>}
          <h3>Accounting reconciliation</h3>
          <p>
            Realised {signed(d.realised)} · Income {euro(d.income)} · Fees{" "}
            {euro(d.fees)} · Cash {euro(d.cash)}
          </p>
        </section>
      )}
      {tab === "Scenarios" && (
        <section className="panel workspace-panel">
          <h2>Scenario laboratory</h2>
          <p>
            Apply shocks to current units while leaving cash unchanged. No
            rebalancing is assumed.
          </p>
          <div className="scenario-form">
            <select
              aria-label="Scenario type"
              value={scenarioKind}
              onChange={(e) => setScenarioKind(e.target.value)}
            >
              <option value="fixed">Fixed holdings shock</option>
              <option value="historical">
                Historical replay · Jan–Mar 2025
              </option>
            </select>
            <label>
              Asset shock (%){" "}
              <input
                type="number"
                value={shock}
                min="-100"
                max="200"
                disabled={scenarioKind === "historical"}
                onChange={(e) => setShock(+e.target.value)}
              />
            </label>
            <button
              className="primary"
              onClick={async () => {
                try {
                  const r = await api("/portfolios/sample/scenario-runs", {
                    kind: scenarioKind,
                    shock: shock / 100,
                  });
                  setScenario(r.result);
                } catch (e) {
                  setError(String(e));
                }
              }}
            >
              Calculate scenario
            </button>
          </div>
          {scenario && (
            <div className="scenario-result">
              <label>Hypothetical portfolio value</label>
              <h1>{euro(scenario.value)}</h1>
              <strong className={scenario.change < 0 ? "negative" : "positive"}>
                {signed(scenario.change)} · {pct(scenario.return_)}
              </strong>
            </div>
          )}
        </section>
      )}
      {tab === "Methodology" && (
        <section className="panel workspace-panel">
          <h2>Calculation assumptions & provenance</h2>
          <p>
            This demonstration uses reproducible synthetic observations
            generated with NumPy seed 73. None of its instruments or benchmark
            values are live market data.
          </p>
          <ol>
            {d.assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ol>
          <p>
            {d.metrics.observations} daily return observations. Concentration
            (HHI, including cash): {d.concentration.toFixed(4)}.
          </p>
          <p>
            Run exports include the frozen transaction snapshot, configuration
            and dataset hashes, random seed, dependency lock hash and
            calculation output.
          </p>
        </section>
      )}

      <footer>
        <span>
          <i />
          SYNTHETIC EUR DATA · NO LIVE MARKET CONNECTION · AS OF {d.as_of}
        </span>
        <span>
          MERIDIAN / RESEARCH BUILD <a href="/">CUSTOM DASHBOARD ↗</a>
        </span>
      </footer>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
