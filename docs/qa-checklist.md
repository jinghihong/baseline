# QA checklist

What is checked before a release, and how. Automated checks run in CI on every push; the browser checks are run by hand (or by an agent driving a browser) on the dev server and again on the live site after deploy.

## Automated (CI: `npm run check`)

- Type-check across the whole app.
- 113 unit and integration tests in `src/**/*.test.ts`, including:
  - every engine (cost forecaster, overtime, under-budgeting, maintenance, debt, scenarios, spend tracker, fiscal notes, hearing prep, district, 311 demand, grants, analyst);
  - the **out-of-sample backtest** of the cost forecaster on the real NYC snapshot (`backtest.test.ts`): no look-ahead, coverage rises with the percentile, and the recommended P80 holds more often than the city's original budget;
  - the **Claude client** (`claude.test.ts`): the real Anthropic SDK against a simulated streaming API, checking the request (model, server-side fallback, adaptive thinking, effort, browser-access header, auth), streamed text assembly, and refusal, rejected-key and missing-key errors.
- Production build plus a route page for every app path (each returns HTTP 200 on GitHub Pages).

## Browser checks (last run Nov 14, 2026)

| Flow | Result |
|---|---|
| Every route renders without the error boundary at 375px and 1400px; no sideways scroll on phones | Pass |
| Light and dark themes | Pass |
| Onboarding: choose Budget office / City council; role switch reorders navigation and Home | Pass |
| Cost forecaster: inputs, Riverside Park preset, live backtest card | Pass |
| Fiscal notes: template, edit, save draft, reset to blank, reopen, delete | Pass |
| Data & imports: CSV upload validates rows (bad row flagged), imports valid rows; imported projects join the forecaster's comparables | Pass |
| Maintenance: asset-register CSV import with row-level errors; back to sample | Pass |
| Spend tracker: monthly-actuals CSV import; year-end projections and at-risk count | Pass |
| Workspace: export (API key stripped even when one is saved), reset with confirmation, import with confirmation, malformed file shows an error | Pass |
| Ask Baseline without a key: built-in analyst answers with sources; `?q=` from the command palette | Pass |
| Browser can reach `api.anthropic.com` from the app's origin (CORS) and read its responses | Pass |
| Live Claude reply with a real API key | Needs the owner's key (Settings → AI connection → Test connection) |

## After every deploy

- `curl -sL -o /dev/null -w '%{http_code}'` on `/`, `/app/`, a few tool routes and `/data/manifest.json`: all 200.
- Open the live site, pick a role, load Home, Cost forecaster and Overtime; confirm no console errors.
