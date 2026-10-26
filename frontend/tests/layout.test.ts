import { describe, expect, it } from "vitest";
import {
  addWidget,
  defaultLayout,
  moveWidget,
  normalizeLayout,
  preset,
  readLayout,
} from "../src/dashboard/layout";
import { returnBins } from "../src/dashboard/histogram";

describe("saved dashboard layouts", () => {
  it("restores defaults when stored JSON is malformed or inaccessible", () => {
    expect(readLayout({ getItem: () => "{broken" })).toEqual(defaultLayout());
    expect(
      readLayout({
        getItem: () => {
          throw Error("blocked");
        },
      }),
    ).toEqual(defaultLayout());
    expect(normalizeLayout({ version: 99, widgets: [] })).toEqual(
      defaultLayout(),
    );
  });
  it("preserves a deliberately empty layout", () => {
    expect(
      normalizeLayout({ version: 1, widgets: [], benchmark: false }),
    ).toEqual({ version: 1, widgets: [], benchmark: false });
  });
  it("retains choices after persistence and sanitizes stale or tampered settings", () => {
    const input = {
      version: 1,
      benchmark: false,
      widgets: [
        { kind: "performance", width: 6, height: "tall", variant: "area" },
        { kind: "performance", width: 12 },
        { kind: "unknown" },
        { kind: "__proto__" },
        {
          kind: "allocation",
          width: 999,
          height: "huge",
          variant: "candlestick",
        },
      ],
    };
    const saved = normalizeLayout(JSON.parse(JSON.stringify(input)));
    expect(saved.widgets).toEqual([
      { kind: "performance", width: 6, height: "tall", variant: "area" },
      { kind: "allocation", width: 2, height: "regular", variant: "donut" },
    ]);
    expect(saved.benchmark).toBe(false);
  });
  it("moves only the chosen widget and keeps all other choices intact", () => {
    const original = defaultLayout(),
      moved = moveWidget(original, 1, 1);
    expect(moved.widgets[2]).toEqual(original.widgets[1]);
    expect(new Set(moved.widgets.map((w) => w.kind))).toEqual(
      new Set(original.widgets.map((w) => w.kind)),
    );
    expect(moveWidget(original, 0, -1)).toBe(original);
  });
  it("adds from the library without duplicates or mutating the existing view", () => {
    const original = defaultLayout(),
      added = addWidget(original, "returns");
    expect(original.widgets).toHaveLength(9);
    expect(added.widgets.at(-1)?.kind).toBe("returns");
    expect(addWidget(added, "returns")).toBe(added);
  });
  it("provides valid complete presets with different analytical focus", () => {
    for (const name of ["reference", "performance", "risk"] as const)
      expect(normalizeLayout(preset(name))).toEqual(preset(name));
    expect(
      preset("performance").widgets.some((w) => w.kind === "returns"),
    ).toBe(true);
    expect(preset("risk").widgets.some((w) => w.kind === "correlation")).toBe(
      true,
    );
  });
});
describe("historical return histogram", () => {
  it("counts observations including both endpoints", () => {
    const result = returnBins([-0.02, -0.01, 0, 0.01, 0.02], 2);
    expect(result.counts).toEqual([2, 3]);
    expect(result.centers[0]).toBeCloseTo(-0.01, 12);
    expect(result.centers[1]).toBeCloseTo(0.01, 12);
  });
  it("represents zero volatility without inventing a nonzero return", () => {
    expect(returnBins([0, 0, 0])).toEqual({ centers: [0], counts: [3] });
    expect(returnBins([])).toEqual({ centers: [], counts: [] });
  });
});
