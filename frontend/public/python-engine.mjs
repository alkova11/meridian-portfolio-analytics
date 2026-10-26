export const PYODIDE_VERSION = "314.0.7";
export const PYODIDE_INDEX = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
export async function initializePython({
  loadPyodide,
  readText,
  options = {},
  status = () => {},
}) {
  status("Loading Python runtime…");
  const py = await loadPyodide(options);
  status("Loading numerical packages (first use)…");
  await py.loadPackage(["numpy", "pandas", "pydantic", "fastapi", "pyarrow"]);
  const root = "/home/pyodide/meridian";
  const files = JSON.parse(await readText("python/bundle.json"));
  for (const file of files) {
    const path = `${root}/${file}`;
    py.FS.mkdirTree(path.slice(0, path.lastIndexOf("/")));
    py.FS.writeFile(path, await readText(`python/${file}`), {
      encoding: "utf8",
    });
  }
  py.globals.set("_fixture_json", await readText("demo-fixture.json"));
  await py.runPythonAsync(`
import sys, os, json
sys.path.insert(0, '${root}')
sys.path.insert(0, '${root}/src')
os.environ['MERIDIAN_STATE_DIRECTORY'] = '${root}/session'
from portfolio_analytics.web_runtime import initialize, dispatch
_runtime = initialize(json.loads(_fixture_json))
`);
  status("");
  return {
    py,
    dispatch: async (url, body) => {
      py.globals.set("_rpc_json", JSON.stringify({ url, body: body ?? null }));
      const text = await py.runPythonAsync(`
_request = json.loads(_rpc_json)
json.dumps(dispatch(_request['url'], _request['body']), allow_nan=False)
`);
      return JSON.parse(text);
    },
  };
}
