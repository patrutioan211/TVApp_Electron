import React, { useState, useEffect } from 'react';

const ANNOUNCEMENTS = [
  'Quarterly town hall today at 16:00, Sky Auditorium – all teams invited.',
  'New security badges required from next week. Collect at reception.',
  'Building maintenance: elevators B block on Saturday 08:00–12:00.',
  'Canteen closed Friday 14:00–16:00 for staff event.',
  'Reminder: Please update your project hours in the booking system by EOD.'
];

function WeatherPanel() {
  const location = 'Aumovio Sibiu';
  const temperature = '24°';
  const condition = 'Sunny';
  const feelsLike = 'Feels like 26°';
  const details = [
    { label: 'Humidity', value: '48%' },
    { label: 'Wind', value: '12 km/h' },
    { label: 'UV Index', value: 'Moderate' }
  ];

  const next4Hours = [
    { time: 'Now', temp: '24°', icon: '☀', cond: 'Sunny' },
    { time: '+1h', temp: '23°', icon: '☀', cond: 'Clear' },
    { time: '+2h', temp: '22°', icon: '⛅', cond: 'Partly cloudy' },
    { time: '+3h', temp: '21°', icon: '⛅', cond: 'Partly cloudy' }
  ];

  const COOLDOWN_MS = 2 * 60 * 1000;
  const visibleCount = 2;
  const [announcementIndex, setAnnouncementIndex] = useState(0);
  const [cooldownStart, setCooldownStart] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      const e = now - cooldownStart;
      setElapsed(e);
      if (e >= COOLDOWN_MS) {
        setAnnouncementIndex((i) => (i + visibleCount) % Math.max(1, ANNOUNCEMENTS.length));
        setCooldownStart(now);
        setElapsed(0);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [cooldownStart]);

  const cooldownPercent = Math.max(0, Math.min(100, 100 - (elapsed / COOLDOWN_MS) * 100));

  const visibleAnnouncements = Array.from({ length: visibleCount }, (_, k) => {
    const idx = (announcementIndex + k) % ANNOUNCEMENTS.length;
    return { id: `${announcementIndex}-${k}`, text: ANNOUNCEMENTS[idx] };
  });

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-0.5">
          <span className="text-[0.65rem] uppercase tracking-[0.2em] text-gray-500">Local weather</span>
          <span className="text-sm font-medium text-gray-700">{location}</span>
        </div>
        <div className="h-12 w-12 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-xl">
          ☀
        </div>
      </div>

      <div className="flex items-end gap-3">
        <span className="text-4xl font-light tabular-nums text-gray-900">{temperature}</span>
        <div className="flex flex-col gap-0">
          <span className="text-sm font-medium text-gray-800">{condition}</span>
          <span className="text-xs text-gray-500">{feelsLike}</span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {next4Hours.map((h) => (
          <div key={h.time} className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-2 flex flex-col items-center gap-0.5">
            <span className="text-[0.6rem] text-gray-500">{h.time}</span>
            <span className="text-lg">{h.icon}</span>
            <span className="text-sm font-semibold text-gray-800">{h.temp}</span>
            <span className="text-[0.6rem] text-gray-500 text-center leading-tight">{h.cond}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {details.map((item) => (
          <div key={item.label} className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5">
            <span className="text-[0.6rem] uppercase tracking-wide text-gray-500">{item.label}</span>
            <p className="text-xs font-medium text-gray-800">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="border-t border-gray-100 pt-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            <span className="text-[0.65rem] uppercase tracking-[0.15em] font-semibold text-gray-600">Announcements</span>
          </div>
          <span className="text-[0.6rem] text-gray-400 tabular-nums">
            {Math.ceil((COOLDOWN_MS - elapsed) / 1000)}s
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden mb-3">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-1000 ease-linear"
            style={{ width: `${cooldownPercent}%` }}
          />
        </div>
        <div className="flex flex-col gap-2 min-h-[3.5rem] mt-1">
          {visibleAnnouncements.map((a) => (
            <p key={a.id} className="text-sm font-medium text-gray-800 leading-snug">
              {a.text}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

export default WeatherPanel;
