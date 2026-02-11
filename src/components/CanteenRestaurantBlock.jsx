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

const CANTEEN_SLOTS_DEFAULT = [
  { time: '10:30', duration: '15 min' },
  { time: '11:30', duration: '15 min' }
];

const RESTAURANT_DEFAULT = {
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

function TrafficView({ trafficFallback }) {
  const fallbackRoutes = trafficFallback?.destinations && Array.isArray(trafficFallback.destinations)
    ? trafficFallback.destinations
    : TRAFFIC_DESTINATIONS_MOCK;
  const fallbackOrigin = trafficFallback?.origin || TRAFFIC_ORIGIN;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      try {
        const result = window.api?.getTrafficData
          ? await window.api.getTrafficData()
          : { origin: fallbackOrigin, routes: fallbackRoutes };
        if (!cancelled) setData(result);
      } catch (e) {
        if (!cancelled) setData({ origin: fallbackOrigin, routes: fallbackRoutes });
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
  const routes = data?.routes ?? fallbackRoutes;
  const origin = data?.origin ?? fallbackOrigin;
  const isLive = data?.isLive ?? false;

  return (
    <div className="w-full flex flex-col gap-2">
      <span className="text-xs uppercase tracking-[0.15em] text-gray-500 truncate">
        Traffic to city
      </span>
      <div className="p-2 rounded-md bg-gray-50 border border-gray-100">
        <p className="text-[0.65rem] text-gray-500 mt-0 mb-1">From {origin}</p>
        <div className="space-y-1.5">
          {routes.map((r, i) => (
            <div key={i} className="flex items-center justify-between gap-1.5">
              <span className="text-sm font-semibold text-gray-900 truncate">{r.destination}</span>
              <span className="shrink-0 text-xs tabular-nums text-gray-600">
                {r.minutes != null ? `${r.minutes} min` : '—'}
              </span>
              <span className={`shrink-0 px-2 py-0.5 rounded border text-xs font-medium ${STATUS_STYLES[r.status] ?? STATUS_STYLES.unknown}`}>
                {STATUS_LABELS[r.status] ?? '—'}
              </span>
            </div>
          ))}
        </div>
        <p className="text-[0.65rem] text-gray-400 mt-1">
          {isLive ? 'Live' : 'Info'} · updates every 20 min
        </p>
      </div>
    </div>
  );
}

function CanteenRestaurantBlock({ canteenMenu: canteenFromWorkspace, traffic: trafficFromWorkspace }) {
  const showTraffic = useShowTraffic();
  if (showTraffic) {
    return <TrafficView trafficFallback={trafficFromWorkspace} />;
  }
  const slots = (canteenFromWorkspace?.slots && Array.isArray(canteenFromWorkspace.slots)) ? canteenFromWorkspace.slots : CANTEEN_SLOTS_DEFAULT;
  const restaurant = canteenFromWorkspace?.restaurant && typeof canteenFromWorkspace.restaurant === 'object' ? canteenFromWorkspace.restaurant : RESTAURANT_DEFAULT;
  const tagline = restaurant.tagline || restaurant.info_restaurant || '';
  const now = new Date();
  const showRestaurantOfDay = now.getHours() * 60 + now.getMinutes() >= 10 * 60 + 30;

  return (
    <div className="w-full flex flex-col gap-1.5 min-h-0 overflow-hidden">
      <span className="text-xs uppercase tracking-[0.15em] text-gray-500 truncate shrink-0">
        Canteen & Restaurant
      </span>
      <div className="p-2 rounded-md bg-gray-50 border border-gray-100 shrink-0">
        <p className="text-sm font-semibold text-gray-900 mb-0">Canteen Menu</p>
        <p className="text-[0.65rem] text-gray-500 mt-0 mb-1 leading-snug">
          {slots.map((s) => `${s.time} (${s.duration || '15 min'})`).join(' · ')}
        </p>
      </div>
      <div className="p-2 rounded-md bg-amber-50 border border-amber-100 flex flex-col gap-0 shrink-0">
        <p className="text-sm font-semibold text-gray-900">Restaurant of the Day</p>
        {showRestaurantOfDay ? (
          <>
            <p className="text-xs text-amber-800 font-medium leading-snug mt-0.5">{restaurant.name}</p>
            <p className="text-[0.65rem] text-gray-500 mt-0 mb-1 leading-snug">{tagline}</p>
          </>
        ) : (
          <p className="text-[0.65rem] text-gray-500 mt-0">De la ora 10:30 →</p>
        )}
      </div>
    </div>
  );
}

export default CanteenRestaurantBlock;
