const fs = require('fs').promises;
const path = require('path');
const simpleGit = require('simple-git');

// Git repo = rădăcina proiectului (WORKSPACE e aici)
const CONTENT_DIR = path.join(__dirname, '..');

// 15 min – git pull; view-ul se actualizează doar când a venit alt commit
const SYNC_INTERVAL_MS = 15 * 60 * 1000;

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

    await gitClient.fetch();
    const result = await gitClient.pull();
    const summary = result && result.summary;
    console.log('Git pull result:', typeof summary === 'string' ? summary : summary);
    // Actualizăm playlist + tot contentul doar dacă pull-ul a adus modificări (alt commit)
    const noChanges = typeof summary === 'string' && /already up to date/i.test(summary);
    return !noChanges;
  } catch (err) {
    console.error('Git sync error:', err.message);
    return false;
  }
}

/**
 * Git pull la 15 min. Apelează onUpdate() doar când pull-ul a adus un commit nou,
 * astfel view-ul reîncarcă playlist + tot conținutul (secțiuni) din workspace.
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

