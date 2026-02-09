import React from 'react';

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

function CanteenRestaurantBlock() {
  const now = new Date();
  const inCanteenWindow = isInCanteenWindow(now);
  const showRestaurantOfDay = now.getHours() * 60 + now.getMinutes() >= 10 * 60 + 30;

  return (
    <div className="w-full flex flex-col gap-3">
      <span className="text-[0.65rem] uppercase tracking-[0.15em] font-semibold text-gray-600">
        Canteen & Restaurant of the day
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
        <p className="text-xs font-semibold text-gray-800">Restaurant of the day</p>
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
