import './App.css'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { Doughnut, Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
} from 'chart.js'
import Papa from 'papaparse'
import { categoryOf } from './lib/categories'

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement)

type UrlTimes = { [host: string]: number }
type DailyData = { [day: string]: UrlTimes }
type Limits = { [host: string]: number } // minutes per day

type Tab = 'today' | 'week' | 'limits'

const MS_PER_MINUTE = 60 * 1000
const MS_PER_HOUR = 60 * MS_PER_MINUTE

// Honey palette: warm cream, amber accent, near-black ink.
const HONEY = ['#f59e0b', '#d97706', '#b45309', '#92400e', '#fbbf24', '#fde68a', '#78350f', '#451a03']
const CATEGORY_COLORS: Record<string, string> = {
  Productivity: '#b45309',
  Entertainment: '#f59e0b',
  Education: '#92400e',
  News: '#d97706',
  Social: '#fbbf24',
  Other: '#d6c7a8',
}

function fmt(ms: number): string {
  if (ms < MS_PER_MINUTE) return `${Math.max(0, Math.round(ms / 1000))}s`
  const h = Math.floor(ms / MS_PER_HOUR)
  const m = Math.round((ms % MS_PER_HOUR) / MS_PER_MINUTE)
  if (h === 0) return `${m}m`
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

function todayKey(d = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

function dayLabel(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

function hasChromeStorage(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.storage?.local
}

// Demo data so the dashboard can be previewed with `npm run dev`, where
// the chrome.* APIs don't exist. Never used inside the real extension.
const DEMO_DAILY: DailyData = (() => {
  const demo: DailyData = {}
  const sites: [string, number][] = [
    ['youtube.com', 96], ['github.com', 74], ['x.com', 41], ['reddit.com', 38],
    ['mail.google.com', 33], ['openai.com', 29], ['netflix.com', 52], ['stackoverflow.com', 22],
  ]
  for (let i = 0; i < 7; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = todayKey(d)
    demo[key] = {}
    for (const [site, min] of sites) {
      const jitter = 0.6 + ((i * 37 + site.length * 13) % 50) / 100
      demo[key][site] = Math.round(min * jitter * MS_PER_MINUTE)
    }
  }
  return demo
})()

function sortedEntries(times: UrlTimes): [string, number][] {
  return Object.entries(times).sort((a, b) => b[1] - a[1])
}

function totalOf(times: UrlTimes): number {
  return Object.values(times).reduce((a, b) => a + b, 0)
}

export default function App() {
  const [today, setToday] = useState<UrlTimes>({})
  const [daily, setDaily] = useState<DailyData>({})
  const [allTime, setAllTime] = useState<UrlTimes>({})
  const [limits, setLimits] = useState<Limits>({})
  const [tab, setTab] = useState<Tab>('today')
  const [newSite, setNewSite] = useState('')
  const [newMinutes, setNewMinutes] = useState('60')
  const [isDemo, setIsDemo] = useState(false)

  const load = useCallback(() => {
    if (!hasChromeStorage()) {
      if (import.meta.env.DEV) {
        setIsDemo(true)
        setDaily(DEMO_DAILY)
        setToday(DEMO_DAILY[todayKey()] || {})
        const all: UrlTimes = {}
        for (const day of Object.values(DEMO_DAILY)) {
          for (const [site, ms] of Object.entries(day)) all[site] = (all[site] || 0) + ms
        }
        setAllTime(all)
        setLimits({ 'youtube.com': 90, 'x.com': 30 })
      }
      return
    }
    chrome.storage.local.get(['urls', 'daily', 'limits'], (result) => {
      if (chrome.runtime.lastError) return
      const d: DailyData = result.daily || {}
      setDaily(d)
      setToday(d[todayKey()] || {})
      setAllTime(result.urls || {})
      setLimits(result.limits || {})
    })
  }, [])

  useEffect(() => {
    load()
    if (!hasChromeStorage()) return
    const onChange = () => load()
    chrome.storage.onChanged.addListener(onChange)
    const timer = window.setInterval(load, 30000)
    return () => {
      chrome.storage.onChanged.removeListener(onChange)
      window.clearInterval(timer)
    }
  }, [load])

  const saveLimits = (next: Limits) => {
    setLimits(next)
    if (hasChromeStorage()) chrome.storage.local.set({ limits: next })
  }

  const addLimit = () => {
    const host = newSite.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
    const minutes = parseInt(newMinutes, 10)
    if (!host || !minutes || minutes <= 0) return
    saveLimits({ ...limits, [host]: minutes })
    setNewSite('')
    setNewMinutes('60')
  }

  const removeLimit = (host: string) => {
    const next = { ...limits }
    delete next[host]
    saveLimits(next)
  }

  const exportCsv = (scope: 'today' | 'all') => {
    const source = scope === 'today' ? today : allTime
    const rows = sortedEntries(source).map(([site, ms]) => ({
      site,
      category: categoryOf(site),
      minutes: Math.round((ms / MS_PER_MINUTE) * 10) / 10,
      time: fmt(ms),
    }))
    const csv = Papa.unparse(rows)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `screen-time-${scope}-${todayKey()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const openCalendar = () => {
    if (hasChromeStorage() && chrome.tabs) {
      chrome.tabs.create({ url: chrome.runtime.getURL('calendar.html') })
    } else {
      window.open('calendar.html', '_blank')
    }
  }

  const todayTotal = totalOf(today)
  const todaySorted = sortedEntries(today)
  const topSite = todaySorted[0]

  const categories = useMemo(() => {
    const out: Record<string, number> = {}
    for (const [site, ms] of Object.entries(today)) {
      const c = categoryOf(site)
      out[c] = (out[c] || 0) + ms
    }
    return out
  }, [today])

  const topSites = todaySorted.slice(0, 8)
  const otherMs = todaySorted.slice(8).reduce((a, [, ms]) => a + ms, 0)

  const doughnutData = {
    labels: [...topSites.map(([s]) => s), ...(otherMs > 0 ? ['Other'] : [])],
    datasets: [
      {
        data: [...topSites.map(([, ms]) => ms), ...(otherMs > 0 ? [otherMs] : [])],
        backgroundColor: HONEY,
        borderColor: '#fffaf0',
        borderWidth: 2,
      },
    ],
  }

  const categoryData = {
    labels: Object.keys(categories),
    datasets: [
      {
        label: 'Minutes',
        data: Object.values(categories).map((ms) => Math.round(ms / MS_PER_MINUTE)),
        backgroundColor: Object.keys(categories).map((c) => CATEGORY_COLORS[c] || CATEGORY_COLORS.Other),
        borderRadius: 6,
      },
    ],
  }

  const last7 = useMemo(() => {
    const days: { key: string; total: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = todayKey(d)
      days.push({ key, total: totalOf(daily[key] || {}) })
    }
    return days
  }, [daily])

  const weekData = {
    labels: last7.map((d) => dayLabel(d.key)),
    datasets: [
      {
        label: 'Minutes',
        data: last7.map((d) => Math.round(d.total / MS_PER_MINUTE)),
        backgroundColor: '#f59e0b',
        borderRadius: 6,
      },
    ],
  }

  const weekTotal = last7.reduce((a, d) => a + d.total, 0)

  return (
    <div className="app">
      <header className="header">
        <img className="logo" src="./bee1.png" alt="" />
        <div>
          <h1>Screen Time</h1>
          <p className="subtitle">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        </div>
        {isDemo && <span className="demo-badge">Demo data</span>}
      </header>

      <nav className="tabs">
        <button className={tab === 'today' ? 'active' : ''} onClick={() => setTab('today')}>Today</button>
        <button className={tab === 'week' ? 'active' : ''} onClick={() => setTab('week')}>Week</button>
        <button className={tab === 'limits' ? 'active' : ''} onClick={() => setTab('limits')}>Limits</button>
      </nav>

      {tab === 'today' && (
        <>
          <section className="stats">
            <div className="stat">
              <span className="stat-value">{fmt(todayTotal)}</span>
              <span className="stat-label">Today</span>
            </div>
            <div className="stat">
              <span className="stat-value">{topSite ? topSite[0] : '—'}</span>
              <span className="stat-label">Top site{topSite ? ` · ${fmt(topSite[1])}` : ''}</span>
            </div>
            <div className="stat">
              <span className="stat-value">{todaySorted.length}</span>
              <span className="stat-label">Sites visited</span>
            </div>
          </section>

          {todaySorted.length === 0 ? (
            <div className="empty">
              <p>No browsing tracked yet.</p>
              <p>Browse a few sites and this dashboard will fill in. Time only counts while Chrome is focused.</p>
            </div>
          ) : (
            <>
              <section className="card">
                <h2>Where today went</h2>
                <div className="chart-wrap">
                  <Doughnut
                    data={doughnutData}
                    options={{
                      plugins: {
                        legend: { position: 'right', labels: { boxWidth: 10, font: { size: 11 } } },
                        tooltip: { callbacks: { label: (c) => ` ${c.label}: ${fmt(Number(c.raw))}` } },
                      },
                      maintainAspectRatio: false,
                    }}
                  />
                </div>
              </section>

              <section className="card">
                <h2>By category</h2>
                <div className="chart-wrap short">
                  <Bar
                    data={categoryData}
                    options={{
                      indexAxis: 'y',
                      plugins: { legend: { display: false } },
                      scales: { x: { ticks: { callback: (v) => `${v}m` } } },
                      maintainAspectRatio: false,
                    }}
                  />
                </div>
              </section>

              <section className="card">
                <h2>All sites today</h2>
                <ul className="site-list">
                  {todaySorted.map(([site, ms]) => {
                    const limit = limits[site]
                    const over = limit !== undefined && ms >= limit * MS_PER_MINUTE
                    const pct = todayTotal > 0 ? Math.round((ms / todayTotal) * 100) : 0
                    return (
                      <li key={site}>
                        <div className="site-row">
                          <span className="site-name">{site}</span>
                          <span className="site-cat">{categoryOf(site)}</span>
                          <span className="site-time">{fmt(ms)}</span>
                        </div>
                        <div className="bar-track">
                          <div className={`bar-fill ${over ? 'over' : ''}`} style={{ width: `${pct}%` }} />
                        </div>
                        {limit !== undefined && (
                          <div className={`limit-note ${over ? 'over' : ''}`}>
                            Limit {limit}m · {over ? 'over limit' : `${fmt(Math.max(0, limit * MS_PER_MINUTE - ms))} left`}
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </section>
            </>
          )}

          <div className="actions">
            <button className="btn" onClick={() => exportCsv('today')}>Export today as CSV</button>
            <button className="btn ghost" onClick={openCalendar}>Open calendar view</button>
          </div>
        </>
      )}

      {tab === 'week' && (
        <>
          <section className="stats">
            <div className="stat">
              <span className="stat-value">{fmt(weekTotal)}</span>
              <span className="stat-label">Last 7 days</span>
            </div>
            <div className="stat">
              <span className="stat-value">{fmt(Math.round(weekTotal / 7))}</span>
              <span className="stat-label">Daily average</span>
            </div>
          </section>

          <section className="card">
            <h2>Minutes per day</h2>
            <div className="chart-wrap">
              <Bar
                data={weekData}
                options={{
                  plugins: { legend: { display: false } },
                  scales: { y: { ticks: { callback: (v) => `${v}m` } } },
                  maintainAspectRatio: false,
                }}
              />
            </div>
            <ul className="day-list">
              {[...last7].reverse().map((d) => (
                <li key={d.key}>
                  <span>{dayLabel(d.key)}</span>
                  <span className="day-total">{fmt(d.total)}</span>
                </li>
              ))}
            </ul>
          </section>

          <div className="actions">
            <button className="btn" onClick={() => exportCsv('all')}>Export all time as CSV</button>
            <button className="btn ghost" onClick={openCalendar}>Open calendar view</button>
          </div>
        </>
      )}

      {tab === 'limits' && (
        <>
          <section className="card">
            <h2>Daily limits</h2>
            <p className="hint">
              Set a daily limit for a site and you'll get a notification the first time you pass it each day.
              Limits are checked against today's total.
            </p>
            <div className="limit-form">
              <input
                value={newSite}
                onChange={(e) => setNewSite(e.target.value)}
                placeholder="youtube.com"
                aria-label="Site"
                onKeyDown={(e) => e.key === 'Enter' && addLimit()}
              />
              <input
                value={newMinutes}
                onChange={(e) => setNewMinutes(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="60"
                aria-label="Minutes per day"
                inputMode="numeric"
                onKeyDown={(e) => e.key === 'Enter' && addLimit()}
              />
              <span className="min-label">min / day</span>
              <button className="btn" onClick={addLimit}>Add limit</button>
            </div>
            {Object.keys(limits).length === 0 ? (
              <p className="empty-inline">No limits yet. Try one for your biggest time sink.</p>
            ) : (
              <ul className="limit-list">
                {Object.entries(limits)
                  .sort((a, b) => (today[b[0]] || 0) - (today[a[0]] || 0))
                  .map(([site]) => {
                  const limitMs = limits[site] * MS_PER_MINUTE
                  const spent = today[site] || 0
                  const pct = Math.min(100, Math.round((spent / limitMs) * 100))
                  const over = spent >= limitMs
                  return (
                    <li key={site}>
                      <div className="site-row">
                        <span className="site-name">{site}</span>
                        <span className="site-time">{fmt(spent)} / {limits[site]}m</span>
                        <button className="remove" onClick={() => removeLimit(site)} aria-label={`Remove limit for ${site}`}>×</button>
                      </div>
                      <div className="bar-track">
                        <div className={`bar-fill ${over ? 'over' : ''}`} style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
          <p className="privacy">All data stays on your device in chrome.storage.local. Nothing is uploaded anywhere.</p>
        </>
      )}
    </div>
  )
}
