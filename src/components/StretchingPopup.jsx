import React, { useEffect, useRef, useState } from 'react';

/** Parse duration from dashboard (e.g. "10 min", "5 min", "2", "15") → milliseconds. Default 10 min. */
function parseDurationToMs(str) {
  if (!str || typeof str !== 'string') return 10 * 60 * 1000;
  const s = str.trim();
  const num = parseInt(s.replace(/\D/g, ''), 10);
  if (Number.isNaN(num) || num < 1) return 10 * 60 * 1000;
  return num * 60 * 1000;
}

/** Same parsing, returns human string e.g. "2 min" for display. */
function formatDuration(str) {
  if (!str || typeof str !== 'string') return '10 min';
  const s = str.trim();
  const num = parseInt(s.replace(/\D/g, ''), 10);
  if (Number.isNaN(num) || num < 1) return '10 min';
  return num === 1 ? '1 min' : `${num} min`;
}

/** Check if current time matches scheduled time. Content.json stores 24h (e.g. "04:48" = 4:48 AM, "16:48" = 4:48 PM). */
function isTimeMatch(scheduledTime, now) {
  if (!scheduledTime || typeof scheduledTime !== 'string') return false;
  const s = scheduledTime.trim();
  const parts = s.split(':');
  const h = parseInt(parts[0], 10);
  const m = parts[1] != null ? parseInt(parts[1], 10) : 0;
  if (Number.isNaN(h) || h < 0 || h > 23 || Number.isNaN(m) || m < 0 || m > 59) return false;
  return now.getHours() === h && now.getMinutes() === m;
}

/** Format 24h from content.json (e.g. "04:48", "16:45") as "h:mm AM/PM" for display. */
function formatTimeAMPM(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return '';
  const parts = timeStr.trim().split(':');
  const h24 = parseInt(parts[0], 10);
  const m = parts[1] != null ? parseInt(parts[1], 10) : 0;
  if (Number.isNaN(h24)) return timeStr;
  const h12 = h24 % 12 || 12;
  const period = h24 < 12 ? 'AM' : 'PM';
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

export default function StretchingPopup({ sections, now: appNow, onClose }) {
  const [visible, setVisible] = useState(false);
  const videoRef = useRef(null);
  const closeTimerRef = useRef(null);

  useEffect(() => {
    const stretching = sections?.stretching?.items?.[0];
    if (!stretching?.video || !stretching?.time || !stretching?.duration) return;
    const current = appNow && appNow instanceof Date ? appNow : new Date();
    if (!isTimeMatch(stretching.time, current)) return;
    setVisible(true);
  }, [sections?.stretching?.items, appNow]);

  useEffect(() => {
    if (!visible) return;
    const stretching = sections?.stretching?.items?.[0];
    const durationMs = parseDurationToMs(stretching?.duration);

    closeTimerRef.current = setTimeout(() => {
      setVisible(false);
      if (typeof onClose === 'function') onClose();
    }, durationMs);

    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, [visible]);

  if (!visible) return null;

  const stretching = sections?.stretching?.items?.[0];
  if (!stretching?.video) return null;

  const videoSrc = stretching.video.startsWith('http') || stretching.video.startsWith('workspace://')
    ? stretching.video
    : 'workspace://./' + stretching.video.replace(/^\.\/+/, '');

  const titleWithTime = stretching.time
    ? `Stretching Time - ${formatTimeAMPM(stretching.time)} (${formatDuration(stretching.duration)})`
    : 'Stretching Time';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      style={{ zIndex: 9999 }}
    >
      <div
        className="relative bg-gray-900 rounded-xl overflow-hidden shadow-2xl flex flex-col items-center justify-center"
        style={{ width: '80vw', height: '80vh' }}
      >
        <h2 className="absolute top-4 left-1/2 -translate-x-1/2 z-10 text-white text-xl font-semibold drop-shadow-lg text-center">
          {titleWithTime}
        </h2>
        <p className="absolute top-14 left-1/2 -translate-x-1/2 z-10 text-white/90 text-sm">
          Acest popup se închide automat la expirarea timpului.
        </p>
        <video
          ref={videoRef}
          src={videoSrc}
          className="w-full h-full object-contain"
          autoPlay
          playsInline
          loop
        />
        <button
          type="button"
          onClick={() => {
            if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
            setVisible(false);
            if (typeof onClose === 'function') onClose();
          }}
          className="absolute top-3 right-3 w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center text-xl leading-none"
          aria-label="Închide"
        >
          ×
        </button>
      </div>
    </div>
  );
}
