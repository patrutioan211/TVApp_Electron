import React, { useEffect, useState, useRef } from 'react';
import Slide from './Slide.jsx';

/**
 * Props:
 * - slides: array of { id, type, src, duration, title?, subtitle? }
 */
function SlidePlayer({ slides }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const timerRef = useRef(null);

  const currentSlide = slides[currentIndex];

  const scheduleNextSlide = () => {
    const durationSeconds = Math.max(1, Number(currentSlide?.duration || 10));
    const durationMs = durationSeconds * 1000;

    timerRef.current = setTimeout(() => {
      // Fade out, then change slide, then fade in
      setIsVisible(false);

      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % slides.length);
        setIsVisible(true);
      }, 700); // match CSS fade duration
    }, durationMs);
  };

  useEffect(() => {
    if (!currentSlide) return;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    scheduleNextSlide();

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, slides.length, currentSlide?.duration]);

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

      <div className="absolute bottom-4 right-6 bg-white/90 border border-gray-200 text-xs text-gray-700 px-3 py-1 rounded-full shadow-sm">
        <span className="mr-2 font-semibold">Slide:</span>
        <span>{currentIndex + 1} / {slides.length}</span>
      </div>
    </div>
  );
}

export default SlidePlayer;

