let bootstrapPromise: Promise<any> | undefined;
let worker: Worker | undefined;
let nextId = 1,
  dirty = false;
const pending = new Map<
  number,
  { resolve: (value: any) => void; reject: (error: Error) => void }
>();
function status(message: string) {
  window.dispatchEvent(
    new CustomEvent("meridian:compute-status", { detail: message }),
  );
}
function bootstrap() {
  return (bootstrapPromise ??= fetch("/demo-bootstrap.json").then((r) => {
    if (!r.ok) throw Error("The public sample could not be loaded");
    return r.json();
  }));
}
function compute(url: string, body?: unknown): Promise<any> {
  if (!worker) {
    worker = new Worker("/python-worker.mjs", { type: "module" });
    worker.onmessage = ({ data }) => {
      if ("status" in data) {
        status(data.status);
        return;
      }
      const task = pending.get(data.id);
      if (!task) return;
      pending.delete(data.id);
      data.error ? task.reject(Error(data.error)) : task.resolve(data.result);
    };
    worker.onerror = () => {
      status("");
      for (const task of pending.values())
        task.reject(
          Error(
            "The Python worker could not start. Check your connection and try again.",
          ),
        );
      pending.clear();
      worker?.terminate();
      worker = undefined;
    };
  }
  const id = nextId++;
  status("Loading Python engine for this calculation…");
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker!.postMessage({ id, url, body });
  });
}
export async function publicApi(url: string, body?: unknown) {
  const cached = await bootstrap();
  if (url === "/portfolios")
    return [
      {
        id: "sample",
        name: "Research portfolio",
        base_currency: "EUR",
        synthetic: true,
      },
    ];
  if (url === "/portfolios/sample/overview" && !dirty) return cached.overview;
  if (url === "/portfolios/sample/simulation-runs" && !dirty) {
    const config = body as Record<string, unknown> | undefined;
    if (
      (config?.paths ?? 10000) === 10000 &&
      (config?.horizon ?? 252) === 252 &&
      (config?.seed ?? 42) === 42 &&
      (config?.method ?? "lognormal") === "lognormal"
    )
      return cached.simulation;
  }
  if (url === `/runs/${cached.simulation.run_id}/exports`)
    return {
      run: cached.simulation,
      overview: cached.overview,
      assumptions: cached.overview.assumptions,
    };
  if (url === `/runs/${cached.simulation.run_id}`) return cached.simulation;
  const result = await compute(url, body);
  if (
    url.startsWith("/imports/") &&
    url.endsWith("/commit") &&
    result.imported > 0
  )
    dirty = true;
  return result;
}
export async function downloadPublicExport(runId: string) {
  const report = await publicApi(`/runs/${runId}/exports`);
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `meridian-${runId}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
