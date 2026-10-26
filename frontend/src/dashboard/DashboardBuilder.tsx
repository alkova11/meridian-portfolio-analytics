import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import {
  CATALOG,
  STORAGE_KEY,
  addWidget,
  defaultLayout,
  moveWidget,
  normalizeLayout,
  preset,
  readLayout,
  type DashboardLayout,
  type Widget,
  type WidgetKind,
} from "./layout";
import "./dashboard-builder.css";

export type WidgetRenderers = Record<
  WidgetKind,
  (widget: Widget, layout: DashboardLayout) => ReactNode
>;
type Props = { renderers: WidgetRenderers };
export function DashboardBuilder({ renderers }: Props) {
  const [layout, setLayout] = useState<DashboardLayout>(() => {
    try {
      return readLayout(window.localStorage);
    } catch {
      return defaultLayout();
    }
  });
  const [editing, setEditing] = useState(false),
    [library, setLibrary] = useState(false),
    [storageError, setStorageError] = useState("");
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
      setStorageError("");
    } catch {
      setStorageError(
        "Browser storage is unavailable. This layout lasts until you leave the page.",
      );
    }
  }, [layout]);
  useEffect(() => {
    const changed = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        try {
          setLayout(
            event.newValue
              ? normalizeLayout(JSON.parse(event.newValue))
              : defaultLayout(),
          );
        } catch {
          setLayout(defaultLayout());
        }
      }
    };
    window.addEventListener("storage", changed);
    return () => window.removeEventListener("storage", changed);
  }, []);
  const change = (index: number, patch: Partial<Widget>) =>
    setLayout((current) =>
      normalizeLayout({
        ...current,
        widgets: current.widgets.map((w, i) =>
          i === index ? { ...w, ...patch } : w,
        ),
      }),
    );
  const count = layout.widgets.length;
  return (
    <section
      className={`dashboard-builder ${editing ? "editing" : ""}`}
      aria-label="Configurable dashboard"
    >
      <div className="builder-toolbar">
        <div>
          <b>YOUR DASHBOARD</b>
          <span>
            {count} sections ·{" "}
            {storageError ? "Session only" : "Saved in this browser"}
          </span>
        </div>
        <div className="builder-actions">
          <label className="preset-label">
            Layout
            <select
              aria-label="Dashboard preset"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value)
                  setLayout(
                    preset(
                      e.target.value as "reference" | "performance" | "risk",
                    ),
                  );
                e.target.value = "";
              }}
            >
              <option value="" disabled>
                Choose a preset
              </option>
              <option value="reference">Reference layout</option>
              <option value="performance">Performance focus</option>
              <option value="risk">Risk focus</option>
            </select>
          </label>
          <button
            className={library ? "selected" : ""}
            onClick={() => setLibrary(!library)}
            aria-expanded={library}
          >
            + Add chart
          </button>
          <button
            className={editing ? "selected" : ""}
            onClick={() => setEditing(!editing)}
            aria-pressed={editing}
          >
            {editing ? "Done editing" : "Customize layout"}
          </button>
        </div>
      </div>
      {storageError && (
        <p className="builder-notice" role="status">
          {storageError}
        </p>
      )}
      {library && (
        <section className="chart-library" aria-label="Chart library">
          <div className="library-heading">
            <div>
              <h2>CHOOSE YOUR CHARTS</h2>
              <p>
                Add any section, then customize its size, style and position.
              </p>
            </div>
            <button
              onClick={() => setLibrary(false)}
              aria-label="Close chart library"
            >
              ✕
            </button>
          </div>
          <div className="library-grid">
            {(Object.keys(CATALOG) as WidgetKind[]).map((kind) => {
              const added = layout.widgets.some((w) => w.kind === kind);
              return (
                <button
                  key={kind}
                  disabled={added}
                  onClick={() => {
                    setLayout((current) => addWidget(current, kind));
                    setEditing(true);
                  }}
                >
                  <span>
                    {CATALOG[kind].label}
                    <b>{added ? "✓ Added" : "+"}</b>
                  </span>
                  <small>{CATALOG[kind].description}</small>
                </button>
              );
            })}
          </div>
        </section>
      )}
      {editing && (
        <div className="builder-options">
          <label>
            <input
              type="checkbox"
              checked={layout.benchmark}
              onChange={(e) =>
                setLayout((current) => ({
                  ...current,
                  benchmark: e.target.checked,
                }))
              }
            />
            Show benchmark on performance chart
          </label>
          <button onClick={() => setLayout(defaultLayout())}>
            Reset to reference layout
          </button>
          <small>Use ↑ / ↓ to reorder. Changes save automatically.</small>
        </div>
      )}
      {count === 0 && (
        <div className="dashboard-empty">
          <h2>Build your view</h2>
          <p>Choose charts from the library or start with a preset.</p>
          <button onClick={() => setLibrary(true)}>
            + Add your first chart
          </button>
          <button onClick={() => setLayout(defaultLayout())}>
            Restore reference layout
          </button>
        </div>
      )}
      <div className="widget-grid">
        {layout.widgets.map((w, index) => (
          <section
            key={w.kind}
            className={`dashboard-widget widget-${w.kind} height-${w.height}`}
            style={{ "--widget-span": w.width } as CSSProperties}
            aria-label={`${CATALOG[w.kind].label} section`}
          >
            {editing && (
              <div className="widget-controls">
                <span>{CATALOG[w.kind].label}</span>
                <div>
                  <label className="sr-only" htmlFor={`width-${w.kind}`}>
                    Width of {CATALOG[w.kind].label}
                  </label>
                  <select
                    id={`width-${w.kind}`}
                    value={w.width}
                    onChange={(e) =>
                      change(index, { width: Number(e.target.value) })
                    }
                  >
                    {CATALOG[w.kind].widths.map((width) => (
                      <option key={width} value={width}>
                        {width === 12 ? "Full width" : `${width}/12 width`}
                      </option>
                    ))}
                  </select>
                  {CATALOG[w.kind].variants[0] !== "table" && (
                    <>
                      <label className="sr-only" htmlFor={`height-${w.kind}`}>
                        Height of {CATALOG[w.kind].label}
                      </label>
                      <select
                        id={`height-${w.kind}`}
                        value={w.height}
                        onChange={(e) =>
                          change(index, {
                            height: e.target.value as Widget["height"],
                          })
                        }
                      >
                        <option value="compact">Compact</option>
                        <option value="regular">Regular</option>
                        <option value="tall">Tall</option>
                      </select>
                    </>
                  )}
                  {CATALOG[w.kind].variants.length > 1 && (
                    <>
                      <label className="sr-only" htmlFor={`style-${w.kind}`}>
                        Style of {CATALOG[w.kind].label}
                      </label>
                      <select
                        id={`style-${w.kind}`}
                        value={w.variant}
                        onChange={(e) =>
                          change(index, { variant: e.target.value })
                        }
                      >
                        {CATALOG[w.kind].variants.map((variant) => (
                          <option key={variant} value={variant}>
                            {variant[0].toUpperCase() + variant.slice(1)}
                          </option>
                        ))}
                      </select>
                    </>
                  )}
                  <button
                    disabled={index === 0}
                    aria-label={`Move ${CATALOG[w.kind].label} up`}
                    onClick={() =>
                      setLayout((current) => moveWidget(current, index, -1))
                    }
                  >
                    ↑
                  </button>
                  <button
                    disabled={index === count - 1}
                    aria-label={`Move ${CATALOG[w.kind].label} down`}
                    onClick={() =>
                      setLayout((current) => moveWidget(current, index, 1))
                    }
                  >
                    ↓
                  </button>
                  <button
                    aria-label={`Remove ${CATALOG[w.kind].label}`}
                    onClick={() =>
                      setLayout((current) => ({
                        ...current,
                        widgets: current.widgets.filter(
                          (item) => item.kind !== w.kind,
                        ),
                      }))
                    }
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
            {renderers[w.kind](w, layout)}
          </section>
        ))}
      </div>
    </section>
  );
}
