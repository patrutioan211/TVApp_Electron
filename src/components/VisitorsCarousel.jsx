import React, { useState, useEffect, useRef } from 'react';

const INTERVAL_MS = 10 * 1000; // 10s for testing (use 45 * 1000 for production)

const CUSTOMER_FEEDBACK = [
  { client: 'AutoTech GmbH', quote: 'Outstanding partnership. The team delivered beyond our expectations and the integration was seamless.' },
  { client: 'Mobility Solutions', quote: 'Professional and responsive. They understood our automotive requirements from day one.' },
  { client: 'Drive Systems Inc.', quote: 'Aumovio\'s expertise in the sector made the difference. We highly recommend them.' }
];

const QUOTES_OF_DAY = [
  'Innovation is not about saying yes to everything. It\'s about saying no to all but the most crucial features.',
  'The best time to plant a tree was 20 years ago. The second best time is now.',
  'Quality is not an act, it is a habit.'
];

const DID_YOU_KNOW = [
  { fact: 'The automotive industry is one of the largest R&D investors globally, with billions spent on electrification and autonomous driving each year.' },
  { fact: 'Aumovio was founded with a focus on bringing software excellence to mobility and manufacturing. Our first project was in powertrain calibration.' },
  { fact: 'Modern vehicles contain over 100 million lines of code—more than many operating systems. Software is at the heart of today\'s cars.' }
];

const WORD_OF_DAY = [
  { word: 'Calibration', meaning: 'The process of adjusting and configuring a system (e.g. engine, sensor) to meet specified performance criteria.' },
  { word: 'OEM', meaning: 'Original Equipment Manufacturer. A company that produces parts or systems used in another company\'s end product.' },
  { word: 'ECU', meaning: 'Electronic Control Unit. A microcontroller that manages one or more electrical systems in a vehicle.' }
];

const REMINDER_HEALTHY_SECTIONS = [
  { title: 'Take a break', text: 'Step away from your screen every 1 hour. Short breaks reduce eye strain and improve focus.' },
  { title: 'Stay hydrated', text: 'Keep a bottle of water at your desk. Hydration supports concentration and overall well-being.' },
  { title: 'Simple stretching', text: 'A few minutes of stretching keeps muscles relaxed and helps prevent tension. Your body will thank you.' }
];

/** One index per calendar day (same day = same quote/fact/word). */
function getDayIndex() {
  const d = new Date();
  return d.getDate() + d.getMonth() * 31 + d.getFullYear() * 366;
}

function useCarousel(getPageCounts, intervalMs) {
  const [categoryIndex, setCategoryIndex] = useState(0);
  const [itemIndex, setItemIndex] = useState(0);
  const [lastTick, setLastTick] = useState(() => Date.now());
  const lastTickRef = useRef(lastTick);
  lastTickRef.current = lastTick;
  const ref = useRef({ categoryIndex: 0, itemIndex: 0 });
  ref.current = { categoryIndex, itemIndex };
  const getPagesRef = useRef(getPageCounts);
  getPagesRef.current = getPageCounts;

  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      const { categoryIndex: cat, itemIndex: item } = ref.current;
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
  }, [intervalMs]);

  return [categoryIndex, itemIndex, lastTick];
}

function useCountdown(lastTick, intervalMs) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return Math.max(0, Math.ceil((lastTick + intervalMs - now) / 1000));
}

const CATEGORIES = [
  'customer_feedback',
  'quote_of_day',
  'did_you_know',
  'word_of_day',
  'reminder_healthy'
];

const CATEGORY_LABELS = {
  customer_feedback: 'Customer feedback',
  quote_of_day: 'Quote of the day',
  did_you_know: 'Did you know',
  word_of_day: 'Word of the day',
  reminder_healthy: 'Reminder healthy (11:45 – 10 min stretching live)'
};

export default function VisitorsCarousel() {
  const pageCounts = [
    CUSTOMER_FEEDBACK.length,
    1, // one quote per day
    1, // one did you know per day
    1, // one word per day
    1
  ];
  const dayIndex = getDayIndex();

  const [catIndex, itemIndex, lastTick] = useCarousel(() => pageCounts, INTERVAL_MS);
  const countdown = useCountdown(lastTick, INTERVAL_MS);
  const category = CATEGORIES[catIndex];

  const renderContent = () => {
    switch (category) {
      case 'customer_feedback': {
        const item = CUSTOMER_FEEDBACK[itemIndex];
        if (!item) return null;
        return (
          <div className="space-y-1.5">
            <p className="text-sm font-semibold text-gray-800">{item.client}</p>
            <p className="text-sm text-gray-600 leading-snug italic">&ldquo;{item.quote}&rdquo;</p>
          </div>
        );
      }
      case 'quote_of_day': {
        const quote = QUOTES_OF_DAY[dayIndex % QUOTES_OF_DAY.length];
        if (!quote) return null;
        return (
          <p className="text-sm text-gray-700 leading-snug italic">&ldquo;{quote}&rdquo;</p>
        );
      }
      case 'did_you_know': {
        const item = DID_YOU_KNOW[dayIndex % DID_YOU_KNOW.length];
        if (!item) return null;
        return (
          <p className="text-sm text-gray-600 leading-snug">{item.fact}</p>
        );
      }
      case 'word_of_day': {
        const item = WORD_OF_DAY[dayIndex % WORD_OF_DAY.length];
        if (!item) return null;
        return (
          <div className="space-y-1.5">
            <p className="text-base font-semibold text-gray-900">{item.word}</p>
            <p className="text-sm text-gray-600 leading-snug">{item.meaning}</p>
          </div>
        );
      }
      case 'reminder_healthy': {
        return (
          <div className="space-y-2">
            {REMINDER_HEALTHY_SECTIONS.map((s, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-[0.65rem] font-semibold text-emerald-600 shrink-0">{s.title}</span>
                <p className="text-xs text-gray-600 leading-snug">{s.text}</p>
              </div>
            ))}
          </div>
        );
      }
      default:
        return null;
    }
  };

  return (
    <div className="rounded-2xl bg-surface border border-gray-200 shadow-sm px-4 py-2 flex flex-col min-h-[5.5rem] h-full flex-1 min-h-0">
      <div className="flex items-center justify-between gap-6 mb-3">
        <span className="text-xs uppercase tracking-[0.2em] text-gray-500">{CATEGORY_LABELS[category]}</span>
        <span className="text-[0.6rem] text-gray-400 tabular-nums shrink-0">{countdown}s</span>
      </div>
      <div className="flex-1 min-h-0 text-gray-800 pt-0.5">
        {renderContent()}
      </div>
    </div>
  );
}
