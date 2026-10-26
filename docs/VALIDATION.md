# Validation record — 25 October 2026

This record describes checks actually completed locally. It does not certify a public release, production deployment or GitHub-hosted CI pass.

| Check | Result |
|---|---|
| Python numerical/API suite | 16 passed, 3.20 s |
| Frontend unit suite | 10 passed across 2 files |
| Ruff check / format check | Passed for src, backend, tests and scripts; 11 files formatted |
| TypeScript + Vite production build | Passed for configurable workspace and preserved draft |
| Playwright test discovery | 2 workflows discovered; browser assertions not executed successfully |
| Synthetic publication dataset | Regenerated in the locked optional publication environment; lock hash matched |
| Research figure | Rendered with locked Matplotlib 3.11.2; inspected visually |
| GitHub Actions | Configured, not run on GitHub |

The accounting fixtures cover independent hand reconciliation, cash-flow invariance, missing-price rejection, risk formulas, split/dividend treatment, seeded simulation, zero volatility, import idempotence, frozen exports and correlation edge cases. Layout tests cover corrupt/unavailable storage, schema fallback, deliberately empty views, stale/unknown/duplicate charts, ordering, adding charts, presets and histogram boundary/constant-return behavior.

Browser visual/end-to-end verification remains pending because saved browser-origin policy blocks localhost observation. No browser workaround was used. The source includes workflows for fan inspection, pointer exit, unchanged terminal results, CSV/scenario/export flows, persisted chart settings and draft isolation. Test discovery and successful compilation do not prove those browser behaviors.

The 2400 × 1350 figure is a standalone analytical plot, not an application screenshot. It uses a fresh synthetic-only fixture, excluding locally imported transactions. The frozen JSON records configuration, seed, dataset/lock hashes, timestamps and assumptions. Git metadata is null because no repository is initialised and the installed Git is blocked by an unaccepted Xcode licence. A large shared Plotly bundle (~5.08 MB / 1.54 MB gzipped) remains a build warning.

## Public deployment validation — 26 October 2026

The public build passed TypeScript/Vite and the existing 26 native/frontend tests. The pinned Pyodide Python worker was additionally exercised in Node: native/WASM valuation and volatility parity, seeded bootstrap repeatability, custom lognormal quantile ordering, scenarios, CSV preview/commit/idempotence, deposit P&L neutrality and export lookup all passed. The worker calls the same Python backend functions rather than a separate JavaScript finance model.

Sites version 1 deployed successfully and its access policy is public. The hosting service produced a native screenshot for review. A direct automated HTTP smoke check was blocked by Cloudflare browser-integrity error 1010 (403); certificate verification remained enabled. No bot protection or browser-origin restriction was bypassed. Native deployment/access metadata verifies publication; this is not a claim that a full browser interaction suite passed.
