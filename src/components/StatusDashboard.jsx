import React, { useState, useEffect, useRef } from 'react';

const INTERVAL_UPTIME_MS = 2 * 60 * 1000;   // 2 min
const INTERVAL_PROJECT_MS = 2 * 60 * 1000;  // 2 min
const INTERVAL_ROOMS_MS = 1 * 60 * 1000;    // 1 min
const INTERVAL_STOCK_MS = 2 * 60 * 1000;    // 2 min

// Field 1 – Uptime services (5 total, 3 per view). statusUrl for validation later.
const UPTIME_SERVICES = [
  { id: 'github', name: 'GitHub', up: true, statusUrl: '' },
  { id: 'jira', name: 'Jira', up: true, statusUrl: '' },
  { id: 'slack', name: 'Slack', up: true, statusUrl: '' },
  { id: 'jenkins', name: 'Jenkins', up: true, statusUrl: '' },
  { id: 'monitor', name: 'Monitor', up: false, statusUrl: '' }
];

// Field 1 – Projects in work. status: 'normal' | 'task_force' | 'maintenance'
const PROJECTS_IN_WORK = [
  { name: 'Alpha', start: '2025-01-15', end: '2025-06-30', progress: 45, status: 'normal' },
  { name: 'Beta', start: '2025-02-01', end: '2025-08-15', progress: 28, status: 'task_force' },
  { name: 'Gamma', start: '2024-11-01', end: '2025-02-28', progress: 100, status: 'maintenance' },
  { name: 'Delta', start: '2025-03-01', end: '2025-09-30', progress: 12, status: 'normal' }
];

// Field 2 – Meeting rooms with today's availability (example slots)
const MEETING_ROOMS = [
  { name: 'Room A', slots: ['08:00–09:00', '09:30–10:30', '11:00–12:00', '13:00–14:00', '14:30–15:30', '16:00–17:00', '17:30–18:00'] },
  { name: 'Room B', slots: ['08:30–10:00', '10:30–12:00', '13:30–14:30', '15:00–16:00', '16:30–17:30'] },
  { name: 'Room C', slots: ['09:00–10:00', '10:30–11:30', '12:00–13:00', '14:00–15:00', '15:30–16:30', '17:00–18:00'] },
  { name: 'Room D', slots: ['08:00–09:30', '10:00–11:00', '11:30–12:30', '14:00–15:00', '15:30–17:00'] },
  { name: 'Room E', slots: ['09:00–10:30', '11:00–12:00', '12:30–13:30', '14:00–15:00', '15:30–16:30', '17:00–18:00'] }
];

// Field 2 – Stock: last 4 months, price in EUR, trend
const STOCK_HISTORY = [
  { month: 'Nov', value: 42 },
  { month: 'Dec', value: 45 },
  { month: 'Jan', value: 43 },
  { month: 'Feb', value: 48 }
];

function GitHubIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

function ServiceIcon({ serviceId, className = 'w-5 h-5' }) {
  if (serviceId === 'github') return <GitHubIcon className={className} />;
  return (
    <div className={`${className} rounded bg-gray-200 flex items-center justify-center text-[0.6rem] font-bold text-gray-500`}>
      {serviceId.slice(0, 2).toUpperCase()}
    </div>
  );
}

function CarIcon({ className = 'w-8 h-8' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 17h14v-5H5v5zm2-6h2v2H7v-2zm8 0h2v2h-2v-2zm-4-6l2-3h4l2 3" />
      <path d="M3 12h18v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5z" />
      <circle cx="7.5" cy="17" r="1.5" fill="currentColor" />
      <circle cx="16.5" cy="17" r="1.5" fill="currentColor" />
    </svg>
  );
}

function useCarousel(getPageCounts, getIntervalMs) {
  const [categoryIndex, setCategoryIndex] = useState(0);
  const [itemIndex, setItemIndex] = useState(0);
  const [lastTick, setLastTick] = useState(() => Date.now());
  const lastTickRef = useRef(lastTick);
  lastTickRef.current = lastTick;
  const ref = useRef({ categoryIndex: 0, itemIndex: 0 });
  ref.current = { categoryIndex, itemIndex };
  const getPagesRef = useRef(getPageCounts);
  getPagesRef.current = getPageCounts;
  const getIntervalRef = useRef(getIntervalMs);
  getIntervalRef.current = getIntervalMs;

  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      const { categoryIndex: cat, itemIndex: item } = ref.current;
      const intervalMs = getIntervalRef.current(cat);
      if (now - lastTickRef.current >= intervalMs) {
        lastTickRef.current = now;
        setLastTick(now);
        const pageCounts = getPagesRef.current();
        const pages = pageCounts[cat] ?? 0;
        if (pages > 0 && item + 1 < pages) {
          setItemIndex(item + 1);
        } else {
          setCategoryIndex((c) => (c + 1) % pageCounts.length);
          setItemIndex(0);
        }
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return [categoryIndex, itemIndex, lastTick];
}

function formatDate(s) {
  const d = new Date(s);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function useCountdown(lastTick, intervalMs) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const remaining = Math.max(0, Math.ceil((lastTick + intervalMs - now) / 1000));
  return remaining;
}

export default function StatusDashboard() {
  const field1Categories = ['uptime', 'projects'];
  const field2Categories = ['rooms', 'stock'];

  const [cat1, item1, lastTick1] = useCarousel(
    () => [Math.ceil(UPTIME_SERVICES.length / 3), PROJECTS_IN_WORK.length],
    (cat) => (cat === 0 ? INTERVAL_UPTIME_MS : INTERVAL_PROJECT_MS)
  );
  const [cat2, item2, lastTick2] = useCarousel(
    () => [MEETING_ROOMS.length, 1],
    (cat) => (cat === 0 ? INTERVAL_ROOMS_MS : INTERVAL_STOCK_MS)
  );

  const interval1Ms = cat1 === 0 ? INTERVAL_UPTIME_MS : INTERVAL_PROJECT_MS;
  const interval2Ms = cat2 === 0 ? INTERVAL_ROOMS_MS : INTERVAL_STOCK_MS;
  const countdown1 = useCountdown(lastTick1, interval1Ms);
  const countdown2 = useCountdown(lastTick2, interval2Ms);

  const field1Label = field1Categories[cat1] === 'uptime' ? 'Uptime services' : 'Project in work';
  const field2Label = field2Categories[cat2] === 'rooms' ? 'Meeting rooms' : 'Aumovio - Share Price';

  return (
    <div className="grid grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] gap-3 w-full h-full flex-1 min-h-0">
      {/* Field 1 – larger, same min-height as Field 2 */}
      <div className="rounded-2xl bg-surface border border-gray-200 shadow-sm px-4 py-2 flex flex-col min-h-[5.5rem]">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs uppercase tracking-[0.2em] text-gray-500">{field1Label}</span>
          <span className="text-[0.6rem] text-gray-400 tabular-nums">{countdown1}s</span>
        </div>
        {field1Categories[cat1] === 'uptime' && (
          <div className="flex flex-wrap gap-4 items-center justify-start flex-1">
            {UPTIME_SERVICES.slice(item1 * 3, item1 * 3 + 3).map((s) => (
              <div key={s.id} className="flex items-center gap-2.5 py-1.5 px-2.5 rounded-lg bg-gray-50 border border-gray-100">
                <ServiceIcon serviceId={s.id} className="w-6 h-6" />
                <span className="text-sm font-semibold text-gray-800">{s.name}</span>
                <span className={`h-2 w-2 rounded-full shrink-0 ${s.up ? 'bg-emerald-500' : 'bg-red-500'}`} title={s.up ? 'Up' : 'Down'} />
              </div>
            ))}
          </div>
        )}
        {field1Categories[cat1] === 'projects' && (() => {
          const p = PROJECTS_IN_WORK[item1];
          if (!p) return null;
          const statusStyles = {
            normal: 'bg-emerald-100 text-emerald-800 border-emerald-200',
            task_force: 'bg-red-100/80 text-red-800 border-red-200',
            maintenance: 'bg-amber-100 text-amber-800 border-amber-200'
          };
          const statusLabels = {
            normal: 'Normal work',
            task_force: 'Task Force',
            maintenance: 'Maintenance/Change Request'
          };
          const statusDot = {
            normal: 'bg-emerald-500',
            task_force: 'bg-red-500',
            maintenance: 'bg-amber-500'
          };
          return (
            <div className="pt-2 flex gap-3 flex-1 min-w-0">
              <div className="shrink-0 text-gray-400">
                <CarIcon />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
                <p className="text-[0.65rem] text-gray-500 mt-0.5">
                  {formatDate(p.start)} → {formatDate(p.end)}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-2 rounded-full bg-gray-200 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${Math.min(100, p.progress)}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-gray-700 tabular-nums">{p.progress}%</span>
                </div>
                <div className="mt-1.5">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[0.65rem] font-medium ${statusStyles[p.status]}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${statusDot[p.status]}`} />
                    {statusLabels[p.status]}
                  </span>
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Field 2 – smaller, fixed min-height to match rooms vs share price */}
      <div className="rounded-2xl bg-surface border border-gray-200 shadow-sm px-4 py-2 flex flex-col min-h-[5.5rem]">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs uppercase tracking-[0.2em] text-gray-500">{field2Label}</span>
          {field2Categories[cat2] === 'rooms' && (
            <span className="inline-flex items-center gap-1.5">
              <span className="text-[0.7rem] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">Live</span>
              <span className="text-[0.6rem] text-gray-400 tabular-nums">{countdown2}s</span>
            </span>
          )}
          {field2Categories[cat2] === 'stock' && (
            <span className="text-[0.6rem] text-gray-400 tabular-nums">{countdown2}s</span>
          )}
        </div>
        {field2Categories[cat2] === 'rooms' && (() => {
          const room = MEETING_ROOMS[item2];
          if (!room) return null;
          return (
            <div className="flex-1 min-h-[3.5rem]">
              <p className="text-sm font-semibold text-gray-900">{room.name}</p>
              <p className="text-[0.65rem] text-gray-500 mt-0.5 mb-1">Availability today</p>
              <div className="flex flex-wrap gap-1.5 h-14 overflow-hidden content-start">
                {room.slots.map((slot) => (
                  <span key={slot} className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                    {slot}
                  </span>
                ))}
              </div>
            </div>
          );
        })()}
        {field2Categories[cat2] === 'stock' && (() => {
          const values = STOCK_HISTORY.map((d) => d.value);
          const min = Math.min(...values);
          const max = Math.max(...values);
          const range = max - min || 1;
          const last = values[values.length - 1];
          const prev = values[values.length - 2];
          const trendUp = last >= prev;
          return (
            <div className="flex-1 flex flex-col min-h-[3.5rem]">
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-xl font-semibold text-gray-900">{last} €</span>
                <span className={`text-xs font-medium ${trendUp ? 'text-emerald-600' : 'text-red-600'}`}>
                  {trendUp ? '↑' : '↓'} {Math.abs(last - prev)} €
                </span>
              </div>
              <div className="flex items-end gap-1 h-14">
                {STOCK_HISTORY.map((d) => (
                  <div key={d.month} className="flex-1 flex flex-col items-center gap-0.5 h-full">
                    <div
                      className="w-full rounded-t bg-accent min-h-[6px]"
                      style={{ height: `${((d.value - min) / range) * 100}%`, maxHeight: '100%' }}
                    />
                    <span className="text-[0.6rem] text-gray-500">{d.month}</span>
                  </div>
                ))}
              </div>
              <p className="text-[0.6rem] text-gray-500 mt-1">Last quarter (EUR)</p>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
