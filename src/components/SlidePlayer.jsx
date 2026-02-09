import React, { useEffect, useState, useRef } from 'react';
import Slide from './Slide.jsx';
import { getSlideDisplay } from '../utils/slideUtils.js';

/**
 * Props:
 * - slides: array of { id, type, src, duration, title?, subtitle? }
 * YouTube/Vimeo: redare în fereastră Electron separată (evită Error 153).
 */
function SlidePlayer({ slides }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const [slideStartTime, setSlideStartTime] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef(null);

  const currentSlide = slides[currentIndex];
  const displayType = currentSlide ? getSlideDisplay(currentSlide).type : null;
  const isVideoExternal = displayType === 'youtube' || displayType === 'vimeo';
  const durationSeconds = Math.max(1, Number(currentSlide?.duration || 10));
  const durationMs = durationSeconds * 1000;
  const cooldownPercent = Math.max(0, Math.min(100, 100 - (elapsed / durationMs) * 100));

  const goNext = () => {
    setIsVisible(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % slides.length);
      setIsVisible(true);
    }, 700);
  };

  const scheduleNextSlide = () => {
    timerRef.current = setTimeout(goNext, durationMs);
  };

  useEffect(() => {
    if (!currentSlide) return;

    if (timerRef.current) clearTimeout(timerRef.current);

    if (isVideoExternal && typeof window !== 'undefined' && window.api?.openVideoSlide) {
      window.api.openVideoSlide({ url: currentSlide.src, durationMs });
      const unsub = window.api.onVideoSlideDone(goNext);
      return () => unsub?.();
    }

    setSlideStartTime(Date.now());
    setElapsed(0);
    scheduleNextSlide();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, slides.length, currentSlide?.duration, currentSlide?.src, isVideoExternal]);

  // Cooldown bar: update elapsed every 200ms
  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Date.now() - slideStartTime);
    }, 200);
    return () => clearInterval(id);
  }, [slideStartTime, currentIndex]);

  // Reset to first slide when slides list changes significantly
  useEffect(() => {
    setCurrentIndex(0);
  }, [JSON.stringify(slides.map((s) => s.id))]);

  return (
    <div className="w-full h-full relative bg-gray-100">
      <div
        className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <Slide slide={currentSlide} />
      </div>

      {/* Cooldown / loading bar */}
      <div className="absolute bottom-0 left-0 right-0 px-4 pb-3">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-[0.6rem] text-white/90 tabular-nums drop-shadow">
            {Math.ceil((durationMs - elapsed) / 1000)}s
          </span>
          <span className="text-[0.6rem] text-white/80 drop-shadow">
            {currentIndex + 1} / {slides.length}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-black/40 overflow-hidden backdrop-blur-sm">
          <div
            className="h-full rounded-full bg-white/90 transition-[width] duration-200 ease-linear"
            style={{ width: `${cooldownPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export default SlidePlayer;

