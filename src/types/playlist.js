// JSDoc type definitions for playlist items

/**
 * Slide type can be explicit or inferred from src (see src/utils/slideUtils.js).
 * @typedef {'image' | 'video' | 'web_url' | 'pdf' | 'pptx' | 'word' | 'excel' | 'vimeo' | 'hls'} SlideType
 */

/**
 * @typedef {Object} Slide
 * @property {string} id
 * @property {SlideType} [type]  Optional; inferred from src if omitted (e.g. .png → image, .docx → word).
 * @property {string} src       URL or workspace:// path. Supported: images | video | .pdf .pptx .docx .doc .xlsx .xls | .m3u8 (HLS) | YouTube / Vimeo URLs.
 * @property {number} duration  In seconds
 * @property {string} [title]
 * @property {string} [subtitle]
 */

/**
 * @typedef {Object} Playlist
 * @property {Slide[]} slides
 */

export {};

