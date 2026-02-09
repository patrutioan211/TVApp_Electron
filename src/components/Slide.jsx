import React from 'react';

function Slide({ slide }) {
  if (!slide) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-200">
        <p className="text-gray-600">No slide to display.</p>
      </div>
    );
  }

  const { type, src, title, subtitle } = slide;

  const commonOverlay = (
    <div className="absolute inset-x-0 bottom-0 p-8 bg-gradient-to-t from-black/80 via-black/0 to-transparent flex flex-col gap-2">
      {title && <h2 className="text-3xl font-semibold text-white drop-shadow">{title}</h2>}
      {subtitle && <p className="text-lg text-gray-200 drop-shadow">{subtitle}</p>}
    </div>
  );

  if (type === 'image') {
    return (
      <div className="w-full h-full relative bg-black">
        <img key={src} src={src} alt={title || 'Slide'} className="w-full h-full object-contain bg-black" />
        {commonOverlay}
      </div>
    );
  }

  if (type === 'video') {
    return (
      <div className="w-full h-full relative bg-black">
        <video key={src} src={src} autoPlay muted loop className="w-full h-full object-contain bg-black" />
        {commonOverlay}
      </div>
    );
  }

  if (type === 'web_url') {
    return (
      <div className="w-full h-full relative bg-black">
        <iframe
          key={src}
          src={src}
          title={title || 'Embedded content'}
          className="w-full h-full border-0"
          allow="fullscreen; clipboard-read; clipboard-write; encrypted-media; geolocation"
        />
        {commonOverlay}
      </div>
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center bg-gray-200">
      <p className="text-gray-600">Unsupported slide type: {String(type)}</p>
    </div>
  );
}

export default Slide;

