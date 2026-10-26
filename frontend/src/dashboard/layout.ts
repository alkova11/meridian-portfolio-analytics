export const STORAGE_KEY = "meridian.dashboard.layout.v1";
export const CATALOG = {
  metrics: {
    label: "Portfolio metrics",
    description: "Volatility, return and risk at a glance",
    widths: [12],
    variants: ["table"],
    width: 12,
  },
  performance: {
    label: "Performance",
    description: "Portfolio wealth with an optional benchmark",
    widths: [4, 6, 8, 10, 12],
    variants: ["line", "area"],
    width: 10,
  },
  allocation: {
    label: "Allocation",
    description: "Asset classes and current holdings",
    widths: [2, 4, 6, 8, 12],
    variants: ["donut", "bar"],
    width: 2,
  },
  drawdown: {
    label: "Drawdown",
    description: "Historical losses from the running peak",
    widths: [4, 6, 8, 12],
    variants: ["area", "line"],
    width: 4,
  },
  simulation: {
    label: "Monte Carlo",
    description: "Seeded outcomes with percentile bands",
    widths: [4, 6, 8, 10, 12],
    variants: ["fan"],
    width: 6,
  },
  outcomes: {
    label: "Terminal outcomes",
    description: "Simulation distribution and statistics",
    widths: [2, 4, 6, 8, 12],
    variants: ["bar", "line"],
    width: 2,
  },
  holdings: {
    label: "Holdings",
    description: "Positions, values, gains and price sparklines",
    widths: [6, 8, 12],
    variants: ["table"],
    width: 12,
  },
  risk: {
    label: "Risk breakdown",
    description: "Calculated metrics with their definitions",
    widths: [4, 6, 8, 12],
    variants: ["table"],
    width: 6,
  },
  correlation: {
    label: "Correlation",
    description: "Daily log-return relationships between holdings",
    widths: [4, 6, 8, 12],
    variants: ["heatmap"],
    width: 6,
  },
  returns: {
    label: "Daily return distribution",
    description: "Historical time-weighted returns, grouped into bins",
    widths: [4, 6, 8, 12],
    variants: ["bar", "line"],
    width: 6,
  },
} as const;
export type WidgetKind = keyof typeof CATALOG;
export type Widget = {
  kind: WidgetKind;
  width: number;
  height: "compact" | "regular" | "tall";
  variant: string;
};
export type DashboardLayout = {
  version: 1;
  widgets: Widget[];
  benchmark: boolean;
};
export const widget = (
  kind: WidgetKind,
  width: number = CATALOG[kind].width,
): Widget => ({
  kind,
  width,
  height: "regular",
  variant: CATALOG[kind].variants[0],
});
export const defaultLayout = (): DashboardLayout => ({
  version: 1,
  benchmark: true,
  widgets: (
    [
      "metrics",
      "performance",
      "allocation",
      "drawdown",
      "simulation",
      "outcomes",
      "holdings",
      "risk",
      "correlation",
    ] as WidgetKind[]
  ).map((k) => widget(k)),
});
export function normalizeLayout(value: unknown): DashboardLayout {
  if (!value || typeof value !== "object") return defaultLayout();
  const source = value as Partial<DashboardLayout>;
  if (source.version !== 1 || !Array.isArray(source.widgets))
    return defaultLayout();
  const seen = new Set<string>();
  const widgets: Widget[] = [];
  for (const item of source.widgets) {
    if (
      !item ||
      typeof item !== "object" ||
      !(item.kind in CATALOG) ||
      seen.has(item.kind)
    )
      continue;
    const kind = item.kind as WidgetKind,
      def = CATALOG[kind];
    if (!Object.hasOwn(CATALOG, kind)) continue;
    seen.add(kind);
    widgets.push({
      kind,
      width: (def.widths as readonly number[]).includes(item.width)
        ? item.width
        : def.width,
      variant: (def.variants as readonly string[]).includes(item.variant)
        ? item.variant
        : def.variants[0],
      height: ["compact", "regular", "tall"].includes(item.height)
        ? item.height
        : "regular",
    });
  }
  return {
    version: 1,
    widgets,
    benchmark: typeof source.benchmark === "boolean" ? source.benchmark : true,
  };
}
export function preset(
  name: "reference" | "performance" | "risk",
): DashboardLayout {
  if (name === "reference") return defaultLayout();
  return {
    version: 1,
    benchmark: true,
    widgets:
      name === "performance"
        ? [
            widget("metrics"),
            widget("performance", 12),
            widget("returns", 6),
            widget("allocation", 6),
            widget("holdings"),
          ]
        : [
            widget("metrics"),
            widget("drawdown", 6),
            widget("correlation", 6),
            widget("simulation", 8),
            widget("outcomes", 4),
            widget("risk", 12),
          ],
  };
}
export function moveWidget(
  layout: DashboardLayout,
  index: number,
  direction: -1 | 1,
): DashboardLayout {
  const next = index + direction;
  if (
    index < 0 ||
    next < 0 ||
    index >= layout.widgets.length ||
    next >= layout.widgets.length
  )
    return layout;
  const widgets = [...layout.widgets];
  [widgets[index], widgets[next]] = [widgets[next], widgets[index]];
  return { ...layout, widgets };
}
export function addWidget(
  layout: DashboardLayout,
  kind: WidgetKind,
): DashboardLayout {
  return layout.widgets.some((w) => w.kind === kind)
    ? layout
    : { ...layout, widgets: [...layout.widgets, widget(kind)] };
}
export function readLayout(storage: Pick<Storage, "getItem">): DashboardLayout {
  try {
    const saved = storage.getItem(STORAGE_KEY);
    return saved ? normalizeLayout(JSON.parse(saved)) : defaultLayout();
  } catch {
    return defaultLayout();
  }
}
