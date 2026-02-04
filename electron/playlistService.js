const fs = require('fs').promises;
const path = require('path');
const simpleGit = require('simple-git');

// Path where your signage content Git repo lives
// e.g. TV_App/content (see README)
const CONTENT_DIR = path.join(__dirname, '..', 'content');
const PLAYLIST_PATH = path.join(CONTENT_DIR, 'playlist.json');

// 5 minutes in ms
const SYNC_INTERVAL_MS = 5 * 60 * 1000;

const git = simpleGit({
  baseDir: CONTENT_DIR,
  maxConcurrentProcesses: 1
});

async function safeReadJSON(filePath) {
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content);
}

async function readPlaylist() {
  try {
    const playlist = await safeReadJSON(PLAYLIST_PATH);

    // Basic normalization/validation
    if (!Array.isArray(playlist.slides)) {
      throw new Error('playlist.json must contain a \"slides\" array');
    }

    return playlist;
  } catch (err) {
    console.error('Failed to read playlist.json:', err.message);
    return {
      slides: [],
      error: err.message
    };
  }
}

async function doGitSync() {
  try {
    // Ensure repo exists and is valid
    await git.fetch();
    const result = await git.pull();
    console.log('Git pull result:', result.summary);
    return true;
  } catch (err) {
    console.error('Git sync error:', err.message);
    return false;
  }
}

/**
 * Initializes periodic git sync (every 5 minutes).
 * Calls onUpdate() whenever a pull finishes.
 */
function initGitSync(onUpdate) {
  // First sync on startup
  doGitSync()
    .then((changed) => {
      if (changed && typeof onUpdate === 'function') {
        onUpdate();
      }
    })
    .catch(() => {});

  // Then periodic sync
  setInterval(async () => {
    const changed = await doGitSync();
    if (changed && typeof onUpdate === 'function') {
      onUpdate();
    }
  }, SYNC_INTERVAL_MS);
}

module.exports = {
  initGitSync,
  readPlaylist
};

