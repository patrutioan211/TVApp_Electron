// JSDoc type definitions for playlist items

/**
 * @typedef {'image' | 'video' | 'web_url'} SlideType
 */

/**
 * @typedef {Object} Slide
 * @property {string} id
 * @property {SlideType} type
 * @property {string} src
 * @property {number} duration  // in seconds
 * @property {string} [title]
 * @property {string} [subtitle]
 */

/**
 * @typedef {Object} Playlist
 * @property {Slide[]} slides
 */

export {};

