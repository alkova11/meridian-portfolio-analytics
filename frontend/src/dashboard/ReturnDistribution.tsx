import { Plot, base } from "../charts/Charts";
import { returnBins } from "./histogram";
export function ReturnDistribution({
  returns,
  variant,
}: {
  returns: number[];
  variant: string;
}) {
  const bins = returnBins(returns);
  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>
          DAILY RETURN DISTRIBUTION <span>HISTORICAL TWR</span>
        </h2>
      </div>
      <div className="return-distribution">
        <Plot
          interactive
          traces={[
            {
              type: variant === "line" ? "scatter" : "bar",
              mode: "lines",
              x: bins.centers,
              y: bins.counts,
              marker: { color: "#648ec7" },
              line: { color: "#8db7ee", width: 1.5 },
              hovertemplate:
                "Daily return %{x:.2%}<br>%{y} observations<extra></extra>",
            },
          ]}
          layout={{
            margin: { l: 40, r: 15, t: 15, b: 35 },
            hovermode: "closest",
            xaxis: { ...base.xaxis, tickformat: ".1%", fixedrange: true },
            yaxis: {
              ...base.yaxis,
              side: "left",
              fixedrange: true,
              tickformat: "d",
            },
            bargap: 0.06,
          }}
        />
      </div>
      <p className="return-note">
        {returns.length} daily observations · counts by return interval ·
        deposits and withdrawals excluded from investment returns
      </p>
    </section>
  );
}
