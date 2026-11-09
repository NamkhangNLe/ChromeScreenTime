// ChromeScreenTime background service worker (Manifest V3).
//
// Tracks time per hostname and stores it in chrome.storage.local:
//   urls    { host: totalMs }            cumulative, all time (kept for compat)
//   daily   { "YYYY-MM-DD": { host: ms } }  per-day totals, powers the week view
//   hourly  { "YYYY-MM-DD": { "0".."23": ms } }  hour-of-day buckets, powers the calendar
//   limits  { host: minutesPerDay }      user-set daily limits
//   notified { host: "YYYY-MM-DD" }      last day a limit notification fired
//
// Everything stays local. Nothing leaves the browser.

const MS_PER_MINUTE = 60 * 1000;

let activeTabId = null;
let activeTabHost = null; // hostname of the active tab, www- stripped
let activeTabStart = null; // timestamp the current stretch started

function stripWww(host) {
  return host.startsWith('www.') ? host.slice(4) : host;
}

function hostOf(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return stripWww(u.hostname);
  } catch {
    return null;
  }
}

function dayKey(ts = Date.now()) {
  const d = new Date(ts);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function hourOf(ts = Date.now()) {
  return new Date(ts).getHours();
}

// Record `ms` milliseconds on `host`, ending at `endTs`. Updates the
// cumulative, daily and hourly stores, then checks the daily limit.
//
// Writes are serialized through a promise queue: two flushes in quick
// succession (e.g. a tab switch plus a window blur) would otherwise read
// the same stale snapshot and one increment would be lost.
let writeQueue = Promise.resolve();

function storageGet(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (result) => {
      resolve(chrome.runtime.lastError ? {} : result);
    });
  });
}

function storageSet(items) {
  return new Promise((resolve) => {
    chrome.storage.local.set(items, () => resolve());
  });
}

function recordTime(host, ms, endTs = Date.now()) {
  if (!host || ms <= 0) return;
  const day = dayKey(endTs);
  const hour = String(hourOf(endTs));

  writeQueue = writeQueue.then(async () => {
    const result = await storageGet(['urls', 'daily', 'hourly', 'limits', 'notified']);
    const urls = result.urls || {};
    const daily = result.daily || {};
    const hourly = result.hourly || {};
    const limits = result.limits || {};
    const notified = result.notified || {};

    urls[host] = (urls[host] || 0) + ms;

    if (!daily[day]) daily[day] = {};
    daily[day][host] = (daily[day][host] || 0) + ms;

    if (!hourly[day]) hourly[day] = {};
    hourly[day][hour] = (hourly[day][hour] || 0) + ms;

    // Daily limit: notify once per host per day when the limit is crossed.
    const limitMinutes = limits[host];
    if (limitMinutes && daily[day][host] >= limitMinutes * MS_PER_MINUTE && notified[host] !== day) {
      notified[host] = day;
      const spentMin = Math.round(daily[day][host] / MS_PER_MINUTE);
      chrome.notifications.create(`limit-${host}-${day}`, {
        type: 'basic',
        iconUrl: 'bee1.png',
        title: 'Screen time limit reached',
        message: `You've spent ${spentMin} min on ${host} today (limit: ${limitMinutes} min).`,
      });
    }

    await storageSet({ urls, daily, hourly, notified });
  });
}

// Flush the time accrued on the currently tracked tab up to `now`, and
// restart the clock at `now` so the next stretch is measured cleanly.
function flushActive(now = Date.now()) {
  if (activeTabHost && activeTabStart !== null) {
    recordTime(activeTabHost, now - activeTabStart, now);
  }
  activeTabStart = now;
}

// Switch tracking to `tabId`, flushing whatever the previous tab accrued.
function activateTab(tabId) {
  flushActive();
  activeTabId = tabId;
  chrome.tabs.get(tabId, (tab) => {
    // A newer activation may have happened while this lookup was in
    // flight; never let a stale callback touch the current tab's state.
    if (tabId !== activeTabId) return;
    if (chrome.runtime.lastError || !tab || !tab.url) {
      activeTabHost = null;
      activeTabStart = null;
      return;
    }
    activeTabHost = hostOf(tab.url);
    activeTabStart = Date.now();
  });
}

// A tab became active.
chrome.tabs.onActivated.addListener((activeInfo) => {
  activateTab(activeInfo.tabId);
});

// The active tab navigated: flush the old URL's time, track the new one.
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (tabId === activeTabId && changeInfo.url) {
    flushActive();
    activeTabHost = hostOf(changeInfo.url);
  }
});

// A tab closed. The tab is already gone, so chrome.tabs.get(tabId) would
// fail and the time would be lost; use the hostname we stored when the
// tab was active instead.
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === activeTabId) {
    flushActive();
    activeTabId = null;
    activeTabHost = null;
    activeTabStart = null;
  }
});

// Chrome lost focus: stop the clock so background time isn't counted.
// When focus returns, re-arm tracking on the active tab.
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    flushActive();
    activeTabStart = null;
  } else if (activeTabId !== null && activeTabStart === null) {
    activateTab(activeTabId);
  }
});

// (Re)start tracking on the currently active tab at install / startup.
function init() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (chrome.runtime.lastError || !tabs || tabs.length === 0) return;
    activeTabId = tabs[0].id;
    activeTabHost = hostOf(tabs[0].url || '');
    activeTabStart = Date.now();
  });
}

chrome.runtime.onInstalled.addListener(init);
chrome.runtime.onStartup.addListener(init);
init();
