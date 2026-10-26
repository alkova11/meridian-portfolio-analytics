export const euro = (v: number) =>
  new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(v);
export const number = (v: number) =>
  new Intl.NumberFormat("en-IE", { maximumFractionDigits: 0 }).format(v);
export const pct = (v: number | null) =>
  v === null ? "—" : `${(v * 100).toFixed(2)}%`;
export const signed = (v: number) =>
  `${v >= 0 ? "+" : "−"}${euro(Math.abs(v))}`;
export const colors = [
  "#7ea6df",
  "#557bad",
  "#3d5f8b",
  "#2a466c",
  "#a9c0df",
  "#45566b",
];
export async function api(url: string, body?: unknown) {
  if (import.meta.env.VITE_PUBLIC_DEMO === "true") {
    const { publicApi } = await import("./public/api");
    return publicApi(url, body);
  }
  const r = await fetch(
    "/api" + url,
    body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const d = await r.json();
  if (!r.ok)
    throw Error(
      typeof d.detail === "string" ? d.detail : JSON.stringify(d.detail),
    );
  return d;
}

export function downloadAnalysis(
  event: { preventDefault: () => void },
  runId: string | undefined,
) {
  if (import.meta.env.VITE_PUBLIC_DEMO !== "true" || !runId) return;
  event.preventDefault();
  void import("./public/api")
    .then((m) => m.downloadPublicExport(runId))
    .catch((e) => window.alert(String(e)));
}
