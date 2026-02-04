import React from 'react';

function WeatherPanel() {
  // Static example data; you can later wire this to a real API.
  const location = 'Aumovio Campus';
  const temperature = '24°';
  const condition = 'Sunny';
  const feelsLike = 'Feels like 26°';
  const details = [
    { label: 'Humidity', value: '48%' },
    { label: 'Wind', value: '12 km/h' },
    { label: 'UV Index', value: 'Moderate' }
  ];

  return (
    <div className="w-full h-full flex flex-col justify-between">
      <div className="flex items-start justify-between mb-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-[0.25em] text-gray-500">
            Local weather
          </span>
          <span className="text-sm font-medium text-gray-200">{location}</span>
        </div>

        <div className="relative h-16 w-16 rounded-2xl bg-gradient-to-br from-sky-400 via-cyan-400 to-emerald-400 flex items-center justify-center shadow-[0_0_40px_8px] shadow-cyan-500/40">
          <div className="h-10 w-10 rounded-full bg-white/90 flex items-center justify-center text-slate-900 font-semibold text-lg">
            ☀
          </div>
        </div>
      </div>

      <div className="flex items-end gap-5 mb-4">
        <div className="flex items-baseline gap-2">
          <span className="text-5xl font-light tabular-nums">{temperature}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-gray-100">{condition}</span>
          <span className="text-xs text-gray-400">{feelsLike}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        {details.map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 flex flex-col gap-1"
          >
            <span className="text-[0.65rem] uppercase tracking-[0.18em] text-gray-500">
              {item.label}
            </span>
            <span className="text-sm text-gray-100">{item.value}</span>
          </div>
        ))}
      </div>

      <div className="mt-auto text-[0.7rem] text-gray-500 leading-relaxed">
        Weather data is indicative for lobby display purposes. For operational decisions, consult
        official Aumovio tools.
      </div>
    </div>
  );
}

export default WeatherPanel;

