"""Prepare a reviewable source ZIP without private state or original reference media."""

import hashlib
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parents[1]
allowed_files = [
    "README.md",
    "CONTRIBUTING.md",
    "THIRD_PARTY_NOTICES.md",
    "pyproject.toml",
    "uv.lock",
    ".gitignore",
    ".env.example",
]
allowed_dirs = [
    ".github",
    "src",
    "backend",
    "tests",
    "scripts",
    "frontend/src",
    "frontend/public",
    "frontend/tests",
    "frontend/e2e",
    "frontend/draft",
    "data/sample",
]
extra_files = [
    "frontend/package.json",
    "frontend/package-lock.json",
    "frontend/index.html",
    "frontend/tsconfig.json",
    "frontend/vite.config.ts",
    "frontend/playwright.config.ts",
    "docs/METHODOLOGY.md",
    "docs/DATA.md",
    "docs/VALIDATION.md",
    "docs/PUBLIC_DEPLOYMENT.md",
    "docs/publication/LINKEDIN-PROJECT.md",
    "reports/benchmark.json",
    "reports/figures/project-overview.png",
    "reports/figures/dashboard-live.png",
    "reports/figures/linkedin-launch.png",
    "reports/publication/synthetic-demo.json",
]
paths = {ROOT / p for p in allowed_files + extra_files if (ROOT / p).is_file()}
for folder in allowed_dirs:
    paths.update(p for p in (ROOT / folder).rglob("*") if p.is_file() and "__pycache__" not in p.parts)
manifest = {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(paths)}
output = ROOT / "reports/publication/meridian-portfolio-analytics-source.zip"
with ZipFile(output, "w", ZIP_DEFLATED) as archive:
    for path in sorted(paths):
        archive.write(path, path.relative_to(ROOT))
    archive.writestr("SOURCE_MANIFEST.json", json.dumps(manifest, indent=2))
print(f"Prepared {len(paths)} source files: {output.relative_to(ROOT)}")
