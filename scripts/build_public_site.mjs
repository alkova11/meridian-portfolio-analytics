import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const python =
  process.platform === "win32"
    ? path.join(root, ".venv/Scripts/python.exe")
    : path.join(root, ".venv/bin/python");
const generated = spawnSync(
  python,
  [path.join(root, "scripts/build_public_demo.py")],
  {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      PYTHONPATH: path.join(root, "src") + path.delimiter + root,
    },
  },
);
if (generated.status !== 0) process.exit(generated.status || 1);
const built = spawnSync(
  process.execPath,
  [path.join(root, "frontend/node_modules/typescript/bin/tsc"), "--noEmit"],
  { cwd: path.join(root, "frontend"), stdio: "inherit" },
);
if (built.status !== 0) process.exit(built.status || 1);
const result = spawnSync(
  process.execPath,
  [
    path.join(root, "frontend/node_modules/vite/bin/vite.js"),
    "build",
    "--outDir",
    "dist-public",
  ],
  {
    cwd: path.join(root, "frontend"),
    stdio: "inherit",
    env: { ...process.env, VITE_PUBLIC_DEMO: "true" },
  },
);
process.exit(result.status || 0);
