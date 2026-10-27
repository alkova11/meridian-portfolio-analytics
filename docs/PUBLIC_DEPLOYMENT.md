# Public deployment — 26 October 2026

Live app: https://meridian-portfolio-analytics-alkova11.adeptrhea24.chatgpt.site

Sites project: `appgprj_6adf87f91ca88191bd53ab842cc9d03e`. Version 1 deployed successfully from source commit `3bcef83c529fa82e141d44d0998897e567b1bc6b`; deployment `appgdep_6adf90c5d42c819186884ac2d2e5a8b7`. The native access policy is **public**, not an owner-only preview. Preserve this identity for updates.

The public build uses the same Python application functions through Pyodide 314.0.7 in a module worker. Default fixture results are precomputed by the native Python package for instant loading. Custom simulation/scenario/import actions initialize the worker. State and trial CSV imports stay in the browser tab, reset on reload, and are not uploaded to a shared API. Layout preferences persist separately in local storage. The repository retains the ordinary FastAPI/local workflow.

Worker integration checks passed: native/WASM valuation and volatility parity, seeded bootstrap repeatability, custom lognormal quantile ordering, scenario direction, CSV validation/commit, duplicate-import idempotence, deposit P&L neutrality and export identity. These Node/WebAssembly checks are not a complete browser-interaction test.

The hosting service supplied a native screenshot, saved as `reports/figures/dashboard-live.png` and visually inspected: the dashboard, synthetic-data banner, layout controls, metrics, performance chart and allocation chart are visible. No application error or login gate is shown. PNG conversion preserves the native screenshot pixels. The separate analytical figure remains `reports/figures/project-overview.png`.

An independent automated HTTP smoke request received Cloudflare 1010/403 (browser integrity protection), rather than an app authentication error. Certificate verification was kept enabled and no bot protection was bypassed. Deployment success/access mode and the native screenshot were verified through the supported Sites tools. Full browser hover/mobile verification remains pending because browser-control tools are unavailable.

Sites deploy checkout: `hosted/meridian/`, with `.openai/hosting.json` pointing to the existing project. An isolated conda-forge Git binary under ignored `.tools/` was used; Xcode agreements and system Git were not changed. Source credentials remained in session memory and stdin, not files or commits.
