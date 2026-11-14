# Architecture

Baseline is a static single-page app plus a scheduled data pipeline. There is no application server: the data is public, the forecasting runs in the browser, and the optional AI calls go from the browser to the Anthropic API with the user's own key. That keeps the product cheap to run, easy to audit, and safe to pilot with a city (no data leaves the user's machine except AI prompts the user chooses to send).

```
NYC Open Data (Socrata) ─┐
Grants.gov Search2 API ──┼─► scripts/fetch-data.mjs ─► public/data/*.json ─► GitHub Pages
                         │      (weekly GitHub Action)                          │
                         │                                                       ▼
                         │                                   Browser: React app loads snapshots
                         │                                   src/engines/* compute forecasts
                         │                                   localStorage holds the workspace
                         └──────────────────────────────►  optional: Anthropic API (user's key)
```

## Layers

| Layer | Where | Rule |
|---|---|---|
| Pipeline | `scripts/` | Aggregates with SoQL on the server side, writes compact JSON with provenance (`meta.sources`, `fetchedAt`). A failed source keeps its last snapshot. |
| Data access | `src/data/` | Typed shapes (`types.ts`), cached loaders (`load.ts`), agency name registry (`agencies.json`), and every published figure with its citation (`curated.ts`). |
| Engines | `src/engines/` | Pure functions, no React, unit-tested. `core.ts` holds the definitions shared by every screen (risk levels, under-budgeting, overtime forecast, capital growth). |
| UI | `src/components/`, `src/pages/` | Design tokens in `index.css` (light and dark), primitives in `ui.tsx`, charts in `charts.tsx`. Pages compose them. |
| Workspace state | `src/state/store.ts` | One JSON document in localStorage: role, settings, saved estimates, notes, imports. Exportable and importable. |
| AI | `src/lib/ai/claude.ts` | Official Anthropic SDK, loaded on demand, streaming, adaptive thinking, server-side refusal fallback. |

## Agency names

Each NYC dataset spells agencies differently ("DEPT OF ENVIRONMENT PROTECTION", "DEPARTMENT OF ENVIRONMENTAL PROTECT.", "DEP"). `src/data/agencies.json` maps every variant to one code with regex patterns and acronyms, used by both the pipeline and the app.

## Expense budget semantics

In the Expense Budget dataset, each June publication carries the adopted budget for the coming fiscal year and, in `current_modified_budget_amount`, the modified budget for the year that is ending. Baseline pairs them so each fiscal year has an adopted figure and an end-of-year modified figure. This was verified against payroll actuals (e.g., Department of Correction FY2026 overtime: $135M adopted, $369M modified, $359M paid).

## Scaling to other cities

Everything city-specific sits in three places: the pipeline tasks (dataset IDs), the agency registry, and `curated.ts`. A new city needs its open-data IDs mapped to the same JSON shapes. Cities without open data can use the CSV imports (projects, assets, monthly spending) that already feed the engines.
