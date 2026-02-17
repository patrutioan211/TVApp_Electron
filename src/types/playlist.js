// JSDoc type definitions for playlist items

/**
 * Slide type can be explicit or inferred from src (see src/utils/slideUtils.js).
 * @typedef {'image' | 'video' | 'web_url' | 'web_live' | 'powerbi' | 'pdf' | 'pptx' | 'word' | 'excel' | 'vimeo' | 'hls'} SlideType
 */

/**
 * @typedef {Object} Slide
 * @property {string} id
 * @property {SlideType} [type]  Optional; inferred from src if omitted (e.g. .png → image, .docx → word).
 * @property {string} src       URL or workspace:// path. Supported: images | video | .pdf .pptx .docx .doc .xlsx .xls | .m3u8 (HLS) | YouTube / Vimeo URLs.
 * @property {number} duration  In seconds
 * @property {string} [title]
 * @property {string} [subtitle]
 * @property {number} [webLiveFit]  For type web_live: zoom-out fit (e.g. 200 = 200% view, scale 0.5; 250 = scale 0.4). Default 250.
 * @property {number} [powerBiFit]  For type powerbi: same as webLiveFit (zoom fit %). Default 100.
 * @property {string} [powerBiPage] For type powerbi: report page name (Power BI pageName URL param).
 */

/**
 * @typedef {Object} Playlist
 * @property {Slide[]} slides
 */

export {};

