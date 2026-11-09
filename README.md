# ChromeScreenTime

A Chrome extension that shows you where your time goes. It tracks the time you spend on each website, breaks it down by site and category, and nudges you when you pass a daily limit you set for a site.

## Features

- **Track time** — automatically records time per site while Chrome is focused.
- **Today / Week / Limits dashboard** — doughnut breakdown by site, bar chart by category, ranked site list, and a 7-day view.
- **Calendar view** — a weekly grid with per-day totals, top sites, and an hour-of-day breakdown.
- **Customizable alerts** — set a daily minute limit per site (e.g. 60 min on youtube.com) and get a notification the first time you pass it each day.
- **Data export** — export today or all-time per-site data as CSV.

## Install (load unpacked)

```bash
git clone https://github.com/NamkhangNLe/ChromeScreenTime.git
cd ChromeScreenTime/ChromeScreenTime
npm install
npm run build
```

Then in Chrome:

1. Go to `chrome://extensions/`.
2. Enable **Developer mode** (toggle, top right).
3. Click **Load unpacked** and select the `dist` folder.

Click the bee icon in the toolbar to open the dashboard.

## Privacy

All data stays on your device in `chrome.storage.local`. Nothing is uploaded anywhere, and there is no account or server.

## Develop

```bash
cd ChromeScreenTime
npm run dev      # preview the dashboard with demo data (chrome.* APIs don't exist outside the extension)
npm run build    # tsc + vite build -> dist/
npm run lint     # eslint
```

## How tracking works

`public/background.js` is the Manifest V3 service worker. It watches tab activation, navigation, tab close, and window focus, and records elapsed time per hostname (with `www.` stripped). Time is stored as cumulative totals plus per-day and per-hour history, so the week and calendar views work without re-processing. Closing a tab, navigating, and losing window focus all flush the accrued time first, so no stretch is lost or double-counted.

## License

MIT.
