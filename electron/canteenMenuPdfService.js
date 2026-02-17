/**
 * Canteen menu PDF: download URLs, convert to images, save to WORKSPACE/<team>/canteen_menu/menu_pdf/.
 * Used at slot times: clear folder, download all PDFs, merge pages as 001.png, 002.png, ...
 */

const path = require('path');
const fs = require('fs').promises;
const workspaceService = require('./workspaceService');

const PROJECT_ROOT = path.join(__dirname, '..');
const WORKSPACE_DIR = path.join(PROJECT_ROOT, 'WORKSPACE');
const MENU_PDF_SUBFOLDER = 'canteen_menu/menu_pdf';
const IMAGE_EXT = '.png';

/**
 * Download a URL to a buffer. Uses Node fetch (Electron/Node 18+).
 * @param {string} url
 * @returns {Promise<Buffer>}
 */
async function downloadPdf(url) {
  const res = await fetch(url, {
    headers: { Accept: 'application/pdf,*/*' },
    redirect: 'follow'
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${url}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0) throw new Error('Empty response');
  return buf;
}

/**
 * Parse range string to 1-based page numbers. "all" or "" -> [1..totalPages], "1-3" -> [1,2,3], "1,3,5" -> [1,3,5].
 * @param {string} rangeStr
 * @param {number} totalPages
 * @returns {number[]}
 */
function parseRange(rangeStr, totalPages) {
  const s = (rangeStr || '').trim().toLowerCase();
  if (!s || s === 'all') {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const out = [];
  for (const part of s.split(',')) {
    const t = part.trim();
    if (t.includes('-')) {
      const [a, b] = t.split('-', 2).map((x) => parseInt(x.trim(), 10));
      if (!Number.isNaN(a) && !Number.isNaN(b)) {
        const lo = Math.max(1, a);
        const hi = Math.min(totalPages, b);
        for (let p = lo; p <= hi; p++) out.push(p);
      }
    } else {
      const p = parseInt(t, 10);
      if (!Number.isNaN(p) && p >= 1 && p <= totalPages) out.push(p);
    }
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

/**
 * Convert a PDF buffer to PNG images for given page range. Uses pdf-to-img (ESM).
 * @param {Buffer} pdfBuffer
 * @param {string} rangeStr - "all", "1-3", "1,3,5", etc.
 * @returns {Promise<{ images: Buffer[] }>}
 */
async function pdfBufferToImages(pdfBuffer, rangeStr) {
  const { pdf } = await import('pdf-to-img');
  const dataUrl = 'data:application/pdf;base64,' + pdfBuffer.toString('base64');
  const document = await pdf(dataUrl, { scale: 2 });
  const totalPages = document.length || 0;
  if (totalPages === 0) return { images: [] };
  const pageNumbers = parseRange(rangeStr || 'all', totalPages);
  const images = [];
  for (const page1Based of pageNumbers) {
    const image = await document.getPage(page1Based);
    if (image) images.push(Buffer.from(image));
  }
  return { images };
}

/**
 * Ensure directory exists and is empty (remove existing files only).
 * @param {string} dirPath
 */
async function clearDir(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
  }
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  for (const e of entries) {
    if (e.isFile()) await fs.unlink(path.join(dirPath, e.name));
  }
}

/**
 * Run canteen menu refresh: clear menu_pdf, download each PDF, convert to images (by range), save in order.
 * @param {string} team
 * @param {Array<{ url: string, range?: string }>} items - Each item: url, range ("all", "1-3", "1,3,5", etc.)
 * @returns {Promise<{ ok: boolean, count?: number, error?: string }>}
 */
async function runCanteenMenuRefresh(team, items) {
  if (!team || !items || !Array.isArray(items)) {
    return { ok: false, error: 'Missing team or items' };
  }
  const validItems = items.filter(
    (it) => it && typeof it.url === 'string' && it.url.trim().startsWith('http')
  );
  if (validItems.length === 0) {
    return { ok: false, error: 'No valid PDF URLs' };
  }

  const teamDir = path.join(WORKSPACE_DIR, team);
  const outDir = path.join(teamDir, MENU_PDF_SUBFOLDER);

  try {
    await clearDir(outDir);
  } catch (e) {
    return { ok: false, error: 'Failed to clear menu folder: ' + (e.message || e) };
  }

  let globalIndex = 0;

  for (const item of validItems) {
    const url = item.url.trim();
    const range = (item.range != null && String(item.range).trim()) || 'all';
    let pdfBuffer;
    try {
      pdfBuffer = await downloadPdf(url);
    } catch (e) {
      return { ok: false, error: 'Download failed: ' + (e.message || e) };
    }

    let images;
    try {
      const result = await pdfBufferToImages(pdfBuffer, range);
      images = result.images || [];
    } catch (e) {
      return { ok: false, error: 'PDF conversion failed: ' + (e.message || e) };
    }

    for (const img of images) {
      globalIndex += 1;
      const name = String(globalIndex).padStart(3, '0') + IMAGE_EXT;
      await fs.writeFile(path.join(outDir, name), img);
    }
  }

  return { ok: true, count: globalIndex };
}

module.exports = {
  runCanteenMenuRefresh,
  MENU_PDF_SUBFOLDER
};
