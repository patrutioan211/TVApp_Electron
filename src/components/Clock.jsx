import React, { useEffect, useState } from 'react';

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatSeconds(date) {
  return date.toLocaleTimeString([], { second: '2-digit' });
}

function formatDate(date) {
  return date.toLocaleDateString([], {
    weekday: 'long',
    month: 'short',
    day: '2-digit',
    year: 'numeric'
  });
}

function Clock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const time = formatTime(now);
  const seconds = formatSeconds(now);
  const date = formatDate(now);

  return (
    <div className="w-full h-full flex flex-col justify-between">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-[0.25em] text-gray-500">
            Aumovio time
          </span>
          <div className="flex items-baseline gap-3">
            <span className="text-6xl xl:text-7xl font-light tabular-nums">{time}</span>
            <span className="text-xl text-accent/80 tabular-nums align-bottom">{seconds}</span>
          </div>
          <span className="mt-2 text-sm text-gray-400">{date}</span>
        </div>

        <div className="flex flex-col items-end gap-2">
          <span className="text-xs uppercase tracking-[0.22em] text-gray-500">
            Status
          </span>
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/40 text-emerald-200 text-xs font-medium">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_2px] shadow-emerald-400/80" />
            Systems nominal
          </span>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 text-xs text-gray-400">
        <div className="flex items-center justify-between">
          <span className="uppercase tracking-[0.18em] text-[0.65rem]">Upcoming</span>
          <span className="text-gray-300">Executive sync – 10:30</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="uppercase tracking-[0.18em] text-[0.65rem]">Shift</span>
          <span className="text-gray-300">Morning operations</span>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-slate-600/60 to-transparent my-1" />
        <p className="text-[0.7rem] leading-relaxed text-gray-500">
          This display is automatically updated every few minutes with the latest playlists and
          metrics from Aumovio&apos;s content repository.
        </p>
      </div>
    </div>
  );
}

export default Clock;

