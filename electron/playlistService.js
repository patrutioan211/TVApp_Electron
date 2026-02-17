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
 * Push la Git cu fișierele date (cale relativă la CONTENT_DIR / rădăcina repo).
 * Folosit de Restaurant of the Day după ce scrie content.json + restaurant_history.json.
 * @param {string[]} relativePaths - ex: ['WORKSPACE/BSW/canteen_menu/content.json', 'WORKSPACE/BSW/canteen_menu/restaurant_history.json']
 * @returns {Promise<boolean>} true dacă push-ul a reușit
 */
async function doGitPush(relativePaths) {
  try {
    const gitClient = await ensureGit();
    if (!gitClient || !Array.isArray(relativePaths) || relativePaths.length === 0) return false;
    await gitClient.add(relativePaths);
    await gitClient.commit('Restaurant of the day update');
    await gitClient.push();
    console.log('Git push OK:', relativePaths.length, 'files');
    return true;
  } catch (err) {
    console.error('Git push error:', err.message);
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
  initGitSync,
  doGitSync,
  doGitPush
};

