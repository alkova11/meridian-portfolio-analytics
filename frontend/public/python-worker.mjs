import { initializePython, PYODIDE_INDEX } from "./python-engine.mjs";
let engine;
const sendStatus = (message) => postMessage({ status: message });
async function getEngine() {
  if (!engine)
    engine = (async () => {
      const { loadPyodide } = await import(PYODIDE_INDEX + "pyodide.mjs");
      return initializePython({
        loadPyodide,
        options: { indexURL: PYODIDE_INDEX },
        readText: async (path) => {
          const response = await fetch(new URL(path, import.meta.url));
          if (!response.ok) throw Error("Unable to load " + path);
          return response.text();
        },
        status: sendStatus,
      });
    })().catch((error) => {
      engine = undefined;
      throw error;
    });
  return engine;
}
let queue = Promise.resolve();
self.onmessage = ({ data }) => {
  queue = queue.then(async () => {
    try {
      const runtime = await getEngine();
      sendStatus("Calculating with Python…");
      const result = await runtime.dispatch(data.url, data.body);
      postMessage({ id: data.id, result });
    } catch (error) {
      postMessage({ id: data.id, error: String(error) });
    } finally {
      sendStatus("");
    }
  });
};
