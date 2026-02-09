import React, { useState, useEffect } from 'react';

const TRAFFIC_ORIGIN = 'Aumovio Sibiu - Strada Salzburg';
const TRAFFIC_DESTINATIONS_MOCK = [
  { destination: 'Centru Sibiu', minutes: 12, status: 'normal' },
  { destination: 'Doamna Stanca Sibiu', minutes: 8, status: 'busy' },
  { destination: 'Vasile Aron Sibiu', minutes: 15, status: 'very_busy' }
];

/** Only between 15:00 and 19:00 show traffic; outside this window show canteen & restaurant and no API call. */
function useShowTraffic() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(id);
  }, []);
  const mins = now.getHours() * 60 + now.getMinutes();
  const start = 15 * 60;   // 15:00
  const end = 19 * 60;     // 19:00
  return mins >= start && mins < end;
}

/** Canteen menu shown only 10:30–10:45 and 11:30–11:45 (15 min each). */
function isInCanteenWindow(date) {
  const mins = date.getHours() * 60 + date.getMinutes();
  return (mins >= 10 * 60 + 30 && mins < 10 * 60 + 45) || (mins >= 11 * 60 + 30 && mins < 11 * 60 + 45);
}

const CANTEEN_SLOTS = [
  { time: '10:30', duration: '15 min' },
  { time: '11:30', duration: '15 min' }
];

const CANTEEN_MENU_TODAY = {
  soup: 'Ciorbă rădăuțeană',
  main: 'Pui la cuptor cu orez',
  salad: 'Salată verde',
  dessert: 'Compot de prune'
};

const RESTAURANT_OF_DAY_EXAMPLE = {
  name: 'La Turn',
  tagline: 'Restaurant & Terrace — recomandat de echipa'
};

const STATUS_LABELS = { normal: 'Normal', busy: 'Busy', very_busy: 'Very busy' };
const STATUS_STYLES = {
  normal: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  busy: 'bg-amber-100 text-amber-800 border-amber-200',
  very_busy: 'bg-red-100 text-red-800 border-red-200',
  unknown: 'bg-gray-100 text-gray-600 border-gray-200'
};

function TrafficView() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      try {
        const result = window.api?.getTrafficData
          ? await window.api.getTrafficData()
          : { origin: TRAFFIC_ORIGIN, routes: TRAFFIC_DESTINATIONS_MOCK };
        if (!cancelled) setData(result);
      } catch (e) {
        if (!cancelled) setData({ origin: TRAFFIC_ORIGIN, routes: TRAFFIC_DESTINATIONS_MOCK });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 20 * 60 * 1000); // refresh every 20 min
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (loading && !data) {
    return (
      <div className="p-2 rounded-lg bg-gray-50 border border-gray-100">
        <p className="text-xs text-gray-500">Loading traffic…</p>
      </div>
    );
  }
  const routes = data?.routes ?? TRAFFIC_DESTINATIONS_MOCK;
  const origin = data?.origin ?? TRAFFIC_ORIGIN;
  const isLive = data?.isLive ?? false;

  return (
    <div className="w-full flex flex-col gap-3">
      <span className="text-[0.65rem] uppercase tracking-[0.15em] font-semibold text-gray-600">
        Traffic to city
      </span>
      <div className="p-2 rounded-lg bg-gray-50 border border-gray-100">
        <p className="text-[0.65rem] text-gray-500 mb-1.5">From {origin}</p>
        <div className="space-y-2">
          {routes.map((r, i) => (
            <div key={i} className="flex items-center justify-between gap-2 text-xs">
              <span className="font-medium text-gray-800 truncate">{r.destination}</span>
              <span className="shrink-0 tabular-nums text-gray-600">
                {r.minutes != null ? `${r.minutes} min` : '—'}
              </span>
              <span className={`shrink-0 px-1.5 py-0.5 rounded border text-[0.65rem] font-medium ${STATUS_STYLES[r.status] ?? STATUS_STYLES.unknown}`}>
                {STATUS_LABELS[r.status] ?? '—'}
              </span>
            </div>
          ))}
        </div>
        <p className="text-[0.6rem] text-gray-400 mt-1.5">
          {isLive ? 'Live' : 'Info'} · updates every 20 min
        </p>
      </div>
    </div>
  );
}

function CanteenRestaurantBlock() {
  const showTraffic = useShowTraffic();
  const now = new Date();
  const inCanteenWindow = isInCanteenWindow(now);
  const showRestaurantOfDay = now.getHours() * 60 + now.getMinutes() >= 10 * 60 + 30;

  if (showTraffic) {
    return <TrafficView />;
  }

  return (
    <div className="w-full flex flex-col gap-3">
      <span className="text-[0.65rem] uppercase tracking-[0.15em] font-semibold text-gray-600">
        Canteen & Restaurant of the Day
      </span>
      <div className="p-2 rounded-lg bg-gray-50 border border-gray-100">
        <p className="text-xs font-semibold text-gray-700 mb-1">Canteen menu</p>
        <p className="text-[0.65rem] text-gray-500 mb-1.5">
          {CANTEEN_SLOTS.map((s) => `${s.time} (${s.duration})`).join(' · ')}
        </p>
        {inCanteenWindow && (
          <ul className="text-xs text-gray-700 space-y-0.5">
            <li>Soup: {CANTEEN_MENU_TODAY.soup}</li>
            <li>Main: {CANTEEN_MENU_TODAY.main}</li>
            <li>Salad: {CANTEEN_MENU_TODAY.salad}</li>
            <li>Dessert: {CANTEEN_MENU_TODAY.dessert}</li>
          </ul>
        )}
      </div>
      <div className="p-2 rounded-lg bg-amber-50 border border-amber-100">
        <p className="text-xs font-semibold text-gray-800">Restaurant of the Day</p>
        {showRestaurantOfDay ? (
          <>
            <p className="text-xs text-amber-800 font-medium mt-0.5">{RESTAURANT_OF_DAY_EXAMPLE.name}</p>
            <p className="text-[0.65rem] text-gray-600 mt-0.5">{RESTAURANT_OF_DAY_EXAMPLE.tagline}</p>
          </>
        ) : (
          <p className="text-xs text-gray-600 mt-0.5">De la ora 10:30 →</p>
        )}
      </div>
    </div>
  );
}

export default CanteenRestaurantBlock;
