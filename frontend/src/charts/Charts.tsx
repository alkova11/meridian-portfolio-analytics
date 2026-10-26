import React, { useEffect, useMemo, useRef, useState } from "react";
import Plotly from "plotly.js-dist-min";
import type { Data, Layout } from "plotly.js";
import { nearestIndex, tooltipLeft } from "../inspect";
import { colors, euro } from "../lib";

const font = '"SFMono-Regular", Consolas, "Liberation Mono", monospace';
export const base: Partial<Layout> = {
  paper_bgcolor: "transparent",
  plot_bgcolor: "transparent",
  font: { family: font, color: "#626e7d", size: 10 },
  margin: { l: 12, r: 53, t: 12, b: 30 },
  showlegend: false,
  hovermode: false,
  autosize: true,
  xaxis: {
    gridcolor: "#10161c",
    showgrid: true,
    zeroline: false,
    ticklen: 0,
    nticks: 6,
  },
  yaxis: {
    gridcolor: "#13191f",
    zeroline: false,
    nticks: 5,
    tickformat: "~s",
    side: "right",
    ticklen: 0,
  },
};
function PlotInner({
  traces,
  layout = {},
  className = "",
  interactive = false,
}: {
  traces: Data[];
  layout?: Partial<Layout>;
  className?: string;
  interactive?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current!;
    void Plotly.react(
      node,
      traces,
      { ...base, ...layout },
      {
        displayModeBar: false,
        responsive: true,
        staticPlot: !interactive,
        scrollZoom: false,
        doubleClick: false,
      },
    );
    const observer = new ResizeObserver(() => {
      void Plotly.Plots.resize(node);
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
      Plotly.purge(node);
    };
  }, [traces, layout, interactive]);
  return (
    <div
      ref={ref}
      className={`plot ${className}${interactive ? " interactive-plot" : ""}`}
    />
  );
}
export const Plot = React.memo(
  PlotInner,
  (a, b) => JSON.stringify(a) === JSON.stringify(b),
);

type Series = { values: number[]; color: string; name: string };
export function InspectChart({
  dates,
  series,
  kind,
  onSelect,
  variant,
}: {
  variant?: "line" | "area";
  dates: string[];
  series: Series[];
  kind: "performance" | "drawdown" | "fan";
  onSelect?: (i: number | null) => void;
}) {
  const [index, setIndex] = useState<number | null>(null);
  const [pointer, setPointer] = useState(0);
  const [pointerY, setPointerY] = useState(20);
  const [size, setSize] = useState({ width: 600, height: 280 });
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current!;
    const observer = new ResizeObserver(([entry]) =>
      setSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  // Reset an inspected date when the horizon or visible history changes.
  useEffect(() => {
    setIndex(null);
    onSelect?.(null);
  }, [dates.length, dates[0], dates.at(-1)]);
  const choose = (i: number | null) => {
    setIndex(i);
    onSelect?.(i);
  };
  const fan = kind === "fan";
  const left = fan ? 48 : 12,
    right = fan ? 12 : 53,
    bottom = 30,
    top = 12;
  const geometry = useMemo(() => {
    const values = series.flatMap((s) => s.values);
    const lo = Math.min(...values),
      hi = Math.max(...values),
      span = Math.max(hi - lo, 0.00001);
    return { min: lo - span * 0.065, max: hi + span * 0.065 };
  }, [series]);
  const traces = useMemo<Data[]>(() => {
    const x = dates.map((_, i) => i);
    if (fan)
      return [
        {
          x,
          y: series[0].values,
          type: "scatter",
          mode: "lines",
          line: { color: "#34547c", width: 0.6 },
        },
        {
          x,
          y: series[4].values,
          type: "scatter",
          mode: "lines",
          line: { color: "#34547c", width: 0.6 },
          fill: "tonexty",
          fillcolor: "rgba(63,111,178,.22)",
        },
        {
          x,
          y: series[1].values,
          type: "scatter",
          mode: "lines",
          line: { color: "#4e76af", width: 0.5 },
        },
        {
          x,
          y: series[3].values,
          type: "scatter",
          mode: "lines",
          line: { color: "#4e76af", width: 0.5 },
          fill: "tonexty",
          fillcolor: "rgba(76,130,208,.30)",
        },
        {
          x,
          y: series[2].values,
          type: "scatter",
          mode: "lines",
          line: { color: "#86ace7", width: 1.5 },
        },
      ];
    return series.map((s) => ({
      x,
      y: s.values,
      type: "scatter",
      mode: "lines",
      hoverinfo: "skip",
      line: { color: s.color, width: 1.3 },
      fill:
        (variant ?? (kind === "drawdown" ? "area" : "line")) === "area"
          ? "tozeroy"
          : undefined,
      fillcolor:
        kind === "drawdown" ? "rgba(184,67,77,.07)" : "rgba(87,135,201,.15)",
    }));
  }, [dates, series, fan, kind, variant]);
  const ticks = [0, 1, 2, 3, 4, 5].map((i) =>
    Math.round(((dates.length - 1) * i) / 5),
  );
  const x =
    index === null
      ? 0
      : left + (index / (dates.length - 1)) * (size.width - left - right);
  const y = (value: number) =>
    top +
    ((geometry.max - value) / (geometry.max - geometry.min)) *
      (size.height - top - bottom);
  return (
    <div
      ref={ref}
      className={`inspect ${kind}`}
      tabIndex={0}
      role="application"
      aria-label={`${kind} chart; use arrow keys to inspect dates`}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault();
          choose(
            Math.max(
              0,
              Math.min(
                dates.length - 1,
                (index ?? 0) + (e.key === "ArrowRight" ? 1 : -1),
              ),
            ),
          );
        } else if (e.key === "Escape") choose(null);
      }}
      onPointerMove={(e) => {
        const bounds = e.currentTarget.getBoundingClientRect();
        setPointer(e.clientX - bounds.left);
        setPointerY(e.clientY - bounds.top);
        choose(
          nearestIndex(
            e.clientX,
            bounds.left + left,
            bounds.width - left - right,
            dates.length,
          ),
        );
      }}
      onPointerLeave={() => choose(null)}
      onBlur={() => choose(null)}
    >
      <Plot
        traces={traces}
        layout={{
          margin: { l: left, r: right, t: top, b: bottom },
          yaxis: {
            ...base.yaxis,
            side: fan ? "left" : "right",
            range: [geometry.min, geometry.max],
            tickformat: kind === "drawdown" ? ".0%" : "~s",
          },
          xaxis: {
            ...base.xaxis,
            range: [0, dates.length - 1],
            tickvals: ticks,
            ticktext: ticks.map((i) => dates[i].slice(0, 7)),
          },
        }}
      />
      {index !== null && (
        <>
          <div className="vguide" style={{ left: x, top, bottom }} />
          {series.map((s) => (
            <span
              key={s.name}
              className="marker"
              style={{ left: x, top: y(s.values[index]), background: s.color }}
            />
          ))}
          {kind === "drawdown" && (
            <div
              className="hguide"
              style={{ top: y(series[0].values[index]), left, right }}
            />
          )}
          {fan && (
            <div
              className="chart-tooltip"
              role="status"
              style={{
                left: tooltipLeft(pointer, size.width),
                top: Math.max(4, Math.min(size.height - 182, pointerY - 70)),
              }}
            >
              <strong>{dates[index]}</strong>
              <small>Simulation day {index}</small>
              {[4, 3, 2, 1, 0].map((i) => (
                <div key={i}>
                  <span>
                    <i style={{ background: series[i].color }} />
                    {series[i].name}
                  </span>
                  <b>{euro(series[i].values[index])}</b>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
export function Spark({
  values,
  color = "#7c9ecb",
  width = 110,
  height = 26,
}: {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  const min = Math.min(...values),
    range = Math.max(...values) - min || 1;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-label={`Last ${values.length} observations`}
    >
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.1"
        points={values
          .map(
            (v, i) =>
              `${(i / (values.length - 1)) * width},${height - 2 - ((v - min) / range) * (height - 4)}`,
          )
          .join(" ")}
      />
    </svg>
  );
}
export function Donut({
  title,
  variant = "donut",
  labels,
  values,
}: {
  title: string;
  variant?: "donut" | "bar";
  labels: string[];
  values: number[];
}) {
  const sum = values.reduce((a, b) => a + b, 0);
  return (
    <section className="allocation">
      <h3>{title}</h3>
      {variant === "bar" ? (
        <div className="allocation-bar">
          <Plot
            interactive
            traces={[
              {
                type: "bar",
                orientation: "h",
                y: labels,
                x: values.map((v) => (v / sum) * 100),
                marker: { color: colors },
                hovertemplate: "%{y}<br>%{x:.2f}%<extra></extra>",
              },
            ]}
            layout={{
              margin: { l: 65, r: 12, t: 8, b: 22 },
              hovermode: "closest",
              xaxis: {
                range: [0, 100],
                ticksuffix: "%",
                fixedrange: true,
                gridcolor: "#182430",
                zeroline: false,
                nticks: 3,
              },
              yaxis: {
                autorange: "reversed",
                fixedrange: true,
                tickfont: { size: 8 },
                showgrid: false,
              },
            }}
          />
        </div>
      ) : (
        <div className="donut">
          <Plot
            traces={[
              {
                type: "pie",
                labels,
                values,
                hole: 0.78,
                sort: false,
                textinfo: "none",
                marker: { colors, line: { color: "#06090c", width: 1 } },
              },
            ]}
            layout={{ margin: { l: 1, r: 1, t: 1, b: 1 } }}
          />
        </div>
      )}
      <div className="allocation-legend">
        {labels.map((label, i) => (
          <div key={label}>
            <span>
              <i style={{ background: colors[i] }} />
              {label}
            </span>
            <b>
              {((values[i] / sum) * 100).toFixed(1)}
              <small>%</small>
            </b>
          </div>
        ))}
      </div>
    </section>
  );
}
