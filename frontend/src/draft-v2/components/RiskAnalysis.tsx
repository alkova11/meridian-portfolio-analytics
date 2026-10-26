import { Plot } from "../charts/Charts";
import { euro, pct } from "../lib";
import type { Overview } from "../types";
import "./risk-analysis.css";

type RiskData = Pick<
  Overview,
  "value" | "metrics" | "beta" | "concentration" | "holdings" | "correlations"
>;
const ratio = (value: number | null) =>
  value === null || !Number.isFinite(value) ? "—" : value.toFixed(2);

export function RiskAnalysis({ data }: { data: RiskData }) {
  const metrics = data.metrics;
  const symbols = data.holdings.map((h) => h.symbol);
  // Undefined/constant-price correlations stay null rather than appearing as zero.
  const matrix = symbols.map((row) =>
    symbols.map((col) => {
      const value = data.correlations[row]?.[col];
      return typeof value === "number" && Number.isFinite(value) ? value : null;
    }),
  );
  const rows = [
    [
      "Volatility (ann.)",
      pct(metrics.volatility),
      "Daily time-weighted return standard deviation × √252.",
    ],
    [
      "Downside deviation",
      pct(metrics.downside_deviation),
      "Annualised RMS of negative excess daily returns; all days included.",
    ],
    [
      "Sharpe ratio",
      ratio(metrics.sharpe),
      "Annualised excess return divided by total volatility.",
    ],
    [
      "Sortino ratio",
      ratio(metrics.sortino),
      "Annualised excess return divided by downside deviation.",
    ],
    [
      "Maximum drawdown",
      pct(metrics.max_drawdown),
      "Largest decline from a previous peak in time-weighted wealth.",
    ],
    [
      "VaR 95% · 1 day",
      euro(metrics.var95 * data.value),
      `${pct(metrics.var95)} of current value; historical 5th-percentile daily return loss.`,
    ],
    [
      "Beta vs benchmark",
      ratio(data.beta),
      "Daily portfolio/benchmark covariance divided by benchmark variance.",
    ],
    [
      "Concentration (HHI)",
      data.concentration.toFixed(4),
      "Sum of squared current portfolio weights, including cash.",
    ],
  ];

  return (
    <section
      className="holdings-analysis"
      aria-label="Portfolio risk and asset correlations"
    >
      <section
        className="risk-breakdown"
        aria-labelledby="risk-breakdown-title"
      >
        <div className="analysis-heading">
          <h2 id="risk-breakdown-title">
            RISK <span>RETURN METRICS / EXPLAINED</span>
          </h2>
        </div>
        <dl className="risk-definition-list">
          {rows.map(([label, value, description]) => (
            <div key={label} className="risk-definition-row">
              <dt>{label}</dt>
              <dd className="risk-metric-value">{value}</dd>
              <dd className="risk-metric-description">{description}</dd>
            </div>
          ))}
        </dl>
        <p className="analysis-footnote">
          {metrics.observations} daily returns · 252-day annualisation · 2%
          effective annual risk-free rate · EUR
        </p>
      </section>
      <section
        className="correlation-panel"
        aria-labelledby="correlation-title"
      >
        <div className="analysis-heading">
          <h2 id="correlation-title">
            CORRELATION <span>DAILY LOG PRICE RETURNS</span>
          </h2>
        </div>
        {symbols.length > 0 ? (
          <>
            <div
              className="correlation-chart"
              role="img"
              aria-label={`Pearson correlation heatmap for ${symbols.join(", ")}. Exact values are available in the data table below.`}
            >
              <Plot
                interactive
                traces={[
                  {
                    type: "heatmap",
                    x: symbols,
                    y: symbols,
                    z: matrix,
                    zmin: -1,
                    zmax: 1,
                    colorscale: [
                      [0, "#34314f"],
                      [0.5, "#111d2b"],
                      [0.75, "#315c80"],
                      [1, "#a0cee5"],
                    ],
                    xgap: 2,
                    ygap: 2,
                    showscale: false,
                    texttemplate: "%{z:.2f}",
                    textfont: { size: 11 },
                    hovertemplate:
                      "%{y} × %{x}<br>Pearson r = %{z:.4f}<extra></extra>",
                    hoverongaps: false,
                  },
                ]}
                layout={{
                  margin: { l: 48, r: 12, t: 12, b: 34 },
                  hovermode: "closest",
                  xaxis: {
                    type: "category",
                    side: "bottom",
                    tickfont: { size: 9, color: "#8394a8" },
                    showgrid: false,
                    zeroline: false,
                    fixedrange: true,
                  },
                  yaxis: {
                    type: "category",
                    side: "left",
                    autorange: "reversed",
                    tickfont: { size: 9, color: "#8394a8" },
                    showgrid: false,
                    zeroline: false,
                    fixedrange: true,
                  },
                  hoverlabel: {
                    bgcolor: "#101923",
                    bordercolor: "#40566e",
                    font: { size: 11, color: "#d8e5f3" },
                  },
                }}
              />
            </div>
            <div className="correlation-legend">
              <span>−1.00</span>
              <i />
              <span>+1.00</span>
              <small>Pearson r · cash excluded</small>
            </div>
            <details className="correlation-data">
              <summary>View correlation data</summary>
              <div className="correlation-table-wrap">
                <table>
                  <caption>
                    Pearson correlations of held assets’ daily log raw-price
                    returns. A dash means undefined.
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Asset</th>
                      {symbols.map((s) => (
                        <th scope="col" key={s}>
                          {s}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {symbols.map((s, i) => (
                      <tr key={s}>
                        <th scope="row">{s}</th>
                        {matrix[i].map((value, j) => (
                          <td key={symbols[j]}>
                            {value === null ? "—" : value.toFixed(4)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        ) : (
          <p className="correlation-empty">
            No held assets to compare. Cash has no defined price-return
            correlation.
          </p>
        )}
      </section>
    </section>
  );
}
