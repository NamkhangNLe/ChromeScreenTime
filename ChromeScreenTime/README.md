# ChromeScreenTime (app)

The extension itself. Vite + React + TypeScript dashboard, plus the Manifest V3 service worker.

## Layout

- `index.html` — dashboard entry (the extension popup).
- `src/main.tsx` — React entry.
- `src/App.tsx` — dashboard: Today / Week / Limits tabs, charts, CSV export.
- `src/lib/categories.ts` — the 1,000-site → category map (exact host, then suffix match).
- `src/App.css`, `src/index.css` — honey theme (warm cream, amber accent).
- `public/manifest.json` — MV3 manifest (`background.js` service worker, `index.html` popup).
- `public/background.js` — time tracking, daily + hourly history, limit notifications.
- `public/calendar.html` — self-contained weekly calendar view (no build step).
- `public/bee1.png` — extension icon.

## Storage schema (`chrome.storage.local`)

- `urls` — `{ host: totalMs }`, cumulative all-time totals.
- `daily` — `{ "YYYY-MM-DD": { host: ms } }`, per-day totals.
- `hourly` — `{ "YYYY-MM-DD": { "0".."23": ms } }`, hour-of-day buckets.
- `limits` — `{ host: minutesPerDay }`, user-set daily limits.
- `notified` — `{ host: "YYYY-MM-DD" }`, last day a limit notification fired.

## Scripts

```bash
npm install
npm run dev      # dashboard preview with demo data
npm run build    # tsc + vite build -> dist/ (load this folder unpacked in chrome://extensions)
npm run lint
```
