const fs = require('fs').promises;
const path = require('path');
const simpleGit = require('simple-git');

// Git repo = rădăcina proiectului (WORKSPACE e aici)
const CONTENT_DIR = path.join(__dirname, '..');

// 5 minutes in ms
const SYNC_INTERVAL_MS = 5 * 60 * 1000;

let git = null;
let contentDirExists = false;

// Lazily determine if content dir exists and is a git repo
async function ensureGit() {
  if (git) return git;

  try {
    const stat = await fs.stat(CONTENT_DIR);
    contentDirExists = stat.isDirectory();
  } catch {
    contentDirExists = false;
  }

  if (!contentDirExists) {
    console.warn('Content directory does not exist at', CONTENT_DIR);
    return null;
  }

  git = simpleGit({
    baseDir: CONTENT_DIR,
    maxConcurrentProcesses: 1
  });

  return git;
}

async function doGitSync() {
  try {
    const gitClient = await ensureGit();
    if (!gitClient) {
      // No content directory or not a git repo yet; nothing to sync
      return false;
    }

    // Ensure repo exists and is valid
    await gitClient.fetch();
    const result = await gitClient.pull();
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
  initGitSync
};

