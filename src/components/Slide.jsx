import React, { useRef, useEffect, useState } from 'react';
import Hls from 'hls.js';
import { getSlideDisplay } from '../utils/slideUtils.js';

function Slide({ slide, onSlideDone, displayKey = 0 }) {
  if (!slide) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-200">
        <p className="text-gray-600">No slide to display.</p>
      </div>
    );
  }

  const { type, src } = getSlideDisplay(slide);
  const { title, subtitle } = slide;

  const commonOverlay = (
    <div className="absolute inset-x-0 bottom-0 p-8 bg-gradient-to-t from-black/80 via-black/0 to-transparent flex flex-col gap-2 pointer-events-none">
      {title && <h2 className="text-3xl font-semibold text-white drop-shadow">{title}</h2>}
      {subtitle && <p className="text-lg text-gray-200 drop-shadow">{subtitle}</p>}
    </div>
  );

  if (type === 'image') {
    const objectFit = slide.fillWidth ? 'object-fill' : 'object-contain';
    return (
      <div className="w-full h-full relative bg-black">
        <img key={src} src={src} alt={title || 'Slide'} className={`w-full h-full ${objectFit} bg-black`} />
        {commonOverlay}
      </div>
    );
  }

  if (type === 'video') {
    return (
      <VideoSlide src={src} sound={slide.videoSound === true} title={title} subtitle={subtitle} />
    );
  }

  if (type === 'hls') {
    return <HlsSlide src={src} title={title} subtitle={subtitle} />;
  }

  if (type === 'pdf' && slide.converted && slide.src) {
    return (
      <DocumentImagesSlide
        folderPath={slide.src}
        duration={Number(slide.duration) || 20}
        title={title}
        subtitle={subtitle}
        onDone={onSlideDone}
        fillWidth={slide.fillWidth === true}
      />
    );
  }

  if (type === 'pdf') {
    return (
      <div className="w-full h-full relative bg-black">
        <iframe
          key={src}
          src={src}
          title={title || 'PDF'}
          className="w-full h-full border-0 bg-white"
        />
        {commonOverlay}
      </div>
    );
  }

  if (type === 'pptx' || type === 'word' || type === 'excel') {
    return (
      <DocumentImagesSlide
        folderPath={src}
        duration={Number(slide.duration) || 20}
        title={title}
        subtitle={subtitle}
        onDone={onSlideDone}
        fillWidth={slide.fillWidth === true}
      />
    );
  }

  if (type === 'web_url' && slide.converted && slide.src) {
    return (
      <DocumentImagesSlide
        folderPath={slide.src}
        duration={Number(slide.duration) || 20}
        title={title}
        subtitle={subtitle}
        onDone={onSlideDone}
        fillWidth={slide.fillWidth === true}
      />
    );
  }

  if (type === 'web_live') {
    if (!src) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-gray-800 text-gray-400">
          <p className="text-sm">Web Live: introduceți URL în playlist.</p>
          {commonOverlay}
        </div>
      );
    }
    const fit = Math.max(50, Math.min(500, Number(slide.webLiveFit) || 250));
    const scale = 100 / fit;
    return (
      <div className="w-full h-full relative bg-black overflow-hidden">
        <div
          className="absolute top-0 left-0 origin-top-left"
          style={{
            width: `${fit}%`,
            height: `${fit}%`,
            transform: `scale(${scale})`
          }}
        >
          <iframe
            key={`web_live_${displayKey}`}
            src={src}
            title={title || 'Web live'}
            className="w-full h-full border-0 block"
            style={{ pointerEvents: 'none' }}
            allow="fullscreen; clipboard-read; clipboard-write"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
        {commonOverlay}
      </div>
    );
  }

  if (type === 'powerbi') {
    if (!src) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-gray-800 text-gray-400">
          <p className="text-sm">Power BI: introduceți URL report/dashboard în playlist.</p>
          {commonOverlay}
        </div>
      );
    }
    const baseUrl = src.trim();
    const pageName = (slide.powerBiPage || '').trim();
    const iframeSrc = pageName
      ? baseUrl + (baseUrl.includes('?') ? '&' : '?') + 'pageName=' + encodeURIComponent(pageName)
      : baseUrl;
    const fit = Math.max(50, Math.min(500, Number(slide.powerBiFit) || 100));
    const scale = 100 / fit;
    return (
      <div className="w-full h-full relative bg-black overflow-hidden">
        <div
          className="absolute top-0 left-0 origin-top-left"
          style={{
            width: `${fit}%`,
            height: `${fit}%`,
            transform: `scale(${scale})`
          }}
        >
          <iframe
            key={`powerbi_${displayKey}`}
            src={iframeSrc}
            title={title || 'Power BI'}
            className="w-full h-full border-0 block"
            style={{ pointerEvents: 'none' }}
            allow="fullscreen"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
        {commonOverlay}
      </div>
    );
  }

  if (type === 'vimeo' || type === 'web_url') {
    return (
      <div className="w-full h-full relative bg-black">
        <iframe
          key={src}
          src={src}
          title={title || 'Embedded content'}
          className="w-full h-full border-0"
          allow="fullscreen; clipboard-read; clipboard-write; encrypted-media; autoplay"
          referrerPolicy="strict-origin-when-cross-origin"
        />
        {commonOverlay}
      </div>
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center bg-gray-200">
      <p className="text-gray-600">Unsupported: {String(type)}</p>
    </div>
  );
}

function VideoSlide({ src, sound, title, subtitle }) {
  const videoRef = useRef(null);
  const muted = !sound;
  const commonOverlay = (
    <div className="absolute inset-x-0 bottom-0 p-8 bg-gradient-to-t from-black/80 via-black/0 to-transparent flex flex-col gap-2 pointer-events-none">
      {title && <h2 className="text-3xl font-semibold text-white drop-shadow">{title}</h2>}
      {subtitle && <p className="text-lg text-gray-200 drop-shadow">{subtitle}</p>}
    </div>
  );
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    const onCanPlay = () => {
      video.play().catch(() => {});
    };
    video.addEventListener('canplay', onCanPlay);
    if (video.readyState >= 2) onCanPlay();
    return () => video.removeEventListener('canplay', onCanPlay);
  }, [src]);
  return (
    <div className="w-full h-full relative bg-black">
      <video
        ref={videoRef}
        key={src}
        src={src}
        autoPlay
        loop
        playsInline
        muted={muted}
        preload="auto"
        className="w-full h-full object-contain bg-black"
      />
      {commonOverlay}
    </div>
  );
}

function DocumentImagesSlide({ folderPath, duration, title, subtitle, onDone, fillWidth }) {
  const [images, setImages] = useState([]);
  const [index, setIndex] = useState(0);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (typeof window === 'undefined' || !window.api?.getWorkspaceFolderImages) {
      setImages([]);
      return;
    }
    let cancelled = false;
    (async () => {
      let list = await window.api.getWorkspaceFolderImages(folderPath);
      if (!cancelled && list.length === 0 && /\.(ppt|pptx|doc|docx|xls|xlsx)$/i.test(folderPath)) {
        const folderAlt = folderPath.replace(/\.[^/.]+$/, '_export');
        list = await window.api.getWorkspaceFolderImages(folderAlt);
      }
      if (!cancelled) setImages(list);
    })();
    return () => { cancelled = true; };
  }, [folderPath]);

  // Fiecare imagine 'duration' secunde; după ultima imagine se apelează onDone (fără loop)
  // Ref pentru onDone ca intervalul să nu fie resetat la fiecare render
  const perImageMs = Math.max(1000, (duration || 20) * 1000);
  useEffect(() => {
    if (images.length === 0) return;
    const t = setInterval(() => {
      setIndex((i) => {
        if (i >= images.length - 1) {
          onDoneRef.current?.();
          return i;
        }
        return i + 1;
      });
    }, perImageMs);
    return () => clearInterval(t);
  }, [images.length, perImageMs]);

  const commonOverlay = (
    <div className="absolute inset-x-0 bottom-0 p-8 bg-gradient-to-t from-black/80 via-black/0 to-transparent flex flex-col gap-2 pointer-events-none">
      {title && <h2 className="text-3xl font-semibold text-white drop-shadow">{title}</h2>}
      {subtitle && <p className="text-lg text-gray-200 drop-shadow">{subtitle}</p>}
    </div>
  );

  if (images.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gray-800 text-gray-300 p-8 text-center">
        <p className="text-sm mb-2">Exportă PPT / Word / Excel în imagini (PNG/JPG) într-un folder.</p>
        <p className="text-xs text-gray-500">În playlist pune src: calea folderului (ex: documents/Prez_export)</p>
        {commonOverlay}
      </div>
    );
  }

  const currentSrc = images[index];
  const objectFit = fillWidth ? 'object-fill' : 'object-contain';
  return (
    <div className="w-full h-full relative bg-black">
      <img key={currentSrc} src={currentSrc} alt="" className={`w-full h-full ${objectFit} bg-black`} />
      {commonOverlay}
    </div>
  );
}

function HlsSlide({ src, title, subtitle }) {
  const videoRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) setError('HLS error');
      });
      return () => {
        hls.destroy();
      };
    }
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      return undefined;
    }
    setError('HLS not supported');
    return undefined;
  }, [src]);

  const commonOverlay = (
    <div className="absolute inset-x-0 bottom-0 p-8 bg-gradient-to-t from-black/80 via-black/0 to-transparent flex flex-col gap-2 pointer-events-none">
      {title && <h2 className="text-3xl font-semibold text-white drop-shadow">{title}</h2>}
      {subtitle && <p className="text-lg text-gray-200 drop-shadow">{subtitle}</p>}
    </div>
  );

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black text-gray-400">
        {error}
        {commonOverlay}
      </div>
    );
  }

  return (
    <div className="w-full h-full relative bg-black">
      <video ref={videoRef} autoPlay loop playsInline className="w-full h-full object-contain bg-black" />
      {commonOverlay}
    </div>
  );
}

export default Slide;
