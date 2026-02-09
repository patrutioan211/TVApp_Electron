const fs = require('fs').promises;
const path = require('path');
const { app } = require('electron');

// WORKSPACE la rădăcina proiectului (același repo)
const PROJECT_ROOT = path.join(__dirname, '..');
const WORKSPACE_DIR = path.join(PROJECT_ROOT, 'WORKSPACE');

// Persistență echipă selectată (userData – nu se resetează la update)
const TEAM_CONFIG_PATH = path.join(app.getPath('userData'), 'signage-team.json');

async function readTeamConfig() {
  try {
    const raw = await fs.readFile(TEAM_CONFIG_PATH, 'utf-8');
    const data = JSON.parse(raw);
    return data.team || null;
  } catch {
    return null;
  }
}

async function writeTeamConfig(team) {
  await fs.mkdir(path.dirname(TEAM_CONFIG_PATH), { recursive: true });
  await fs.writeFile(TEAM_CONFIG_PATH, JSON.stringify({ team: team || null }, null, 2), 'utf-8');
}

/**
 * Listează echipele = subdirectoare din WORKSPACE
 */
async function getTeams() {
  try {
    const stat = await fs.stat(WORKSPACE_DIR);
    if (!stat.isDirectory()) return [];
  } catch {
    return [];
  }
  const entries = await fs.readdir(WORKSPACE_DIR, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
}

async function getSelectedTeam() {
  return readTeamConfig();
}

async function setSelectedTeam(team) {
  await writeTeamConfig(team);
  return true;
}

function getWorkspaceDir() {
  return WORKSPACE_DIR;
}

/**
 * Citește playlist-ul din WORKSPACE/<team>/playlist.json.
 * Căile din slides (src) relative la directorul echipei sunt transformate în workspace://./...
 */
async function getPlaylistForTeam(team) {
  if (!team) {
    return { slides: [], error: 'No team selected' };
  }
  const teamDir = path.join(WORKSPACE_DIR, team);
  const playlistPath = path.join(teamDir, 'playlist.json');
  try {
    const raw = await fs.readFile(playlistPath, 'utf-8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data.slides)) {
      return { slides: [], error: 'playlist.json must contain a "slides" array' };
    }
    // Resolve relative paths to workspace:// URL so renderer can load them
    const baseUrl = 'workspace://./';
    const slides = data.slides.map((s) => {
      const slide = { ...s };
      if (slide.src && !slide.src.startsWith('http://') && !slide.src.startsWith('https://') && !slide.src.startsWith('workspace://')) {
        slide.src = baseUrl + slide.src.replace(/\\/g, '/');
      }
      return slide;
    });
    return { ...data, slides };
  } catch (err) {
    console.error('Failed to read playlist for team', team, err.message);
    return { slides: [], error: err.message };
  }
}

/**
 * Calea absolută către un fișier din workspace (pentru protocol handler).
 * subpath = e.g. "photos/1.jpg"
 */
async function getWorkspaceFilePath(subpath) {
  const team = await readTeamConfig();
  if (!team) return null;
  const decoded = decodeURIComponent(subpath).replace(/\\/g, '/').replace(/\.\./g, '');
  const teamDir = path.join(WORKSPACE_DIR, team);
  const fullPath = path.resolve(teamDir, decoded);
  const relative = path.relative(teamDir, fullPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return fullPath;
}

module.exports = {
  getWorkspaceDir,
  getTeams,
  getSelectedTeam,
  setSelectedTeam,
  getPlaylistForTeam,
  getWorkspaceFilePath
};
