import React, { useEffect, useState } from 'react';
import SlidePlayer from './components/SlidePlayer.jsx';
import Clock from './components/Clock.jsx';
import WeatherPanel from './components/WeatherPanel.jsx';
import InfoCarousel from './components/InfoCarousel.jsx';
import AumovioLogo from './components/AumovioLogo.jsx';
import TeamSelection from './components/TeamSelection.jsx';

function App() {
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teamCheckDone, setTeamCheckDone] = useState(false);
  const [playlist, setPlaylist] = useState({ slides: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  const greeting = (() => {
    const h = now.getHours();
    if (h < 12) return 'Good Morning';
    if (h < 18) return 'Good Afternoon';
    return 'Good Evening';
  })();

  useEffect(() => {
    if (!window.api?.getSelectedTeam) {
      setTeamCheckDone(true);
      return;
    }
    window.api.getSelectedTeam().then((team) => {
      setSelectedTeam(team || null);
      setTeamCheckDone(true);
    }).catch(() => setTeamCheckDone(true));
  }, []);

  const loadPlaylist = async () => {
    if (!selectedTeam) return;
    try {
      setLoading(true);
      if (!window.api?.getPlaylist) {
        setError('This app runs in Electron. Do not open the URL in a browser.');
        setLoading(false);
        return;
      }
      const data = await window.api.getPlaylist();
      if (data.error) {
        setError(data.error);
      } else {
        setError('');
      }
      setPlaylist(data);
    } catch (err) {
      console.error(err);
      setError('Failed to load playlist from main process.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedTeam) return;
    loadPlaylist();
    if (!window.api?.onPlaylistUpdated) return;
    const unsubscribe = window.api.onPlaylistUpdated(() => loadPlaylist());
    return () => unsubscribe?.();
  }, [selectedTeam]);

  if (typeof window !== 'undefined' && !window.api?.getPlaylist) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-white text-slate-800 px-8">
        <h1 className="text-4xl font-bold mb-6 text-slate-900">Digital Signage</h1>
        <p className="text-xl text-center text-slate-600 mb-2">
          This app runs in Electron, not in the browser.
        </p>
        <p className="text-2xl font-mono font-semibold mt-6 text-cyan-600">npm start</p>
        <p className="text-sm text-slate-500 mt-4">Run this in the project folder, then use the Electron window.</p>
      </div>
    );
  }

  if (!teamCheckDone) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-background text-gray-600">
        <p className="text-xl">Loading…</p>
      </div>
    );
  }

  if (teamCheckDone && selectedTeam === null) {
    return <TeamSelection onSelect={(team) => setSelectedTeam(team)} />;
  }

  if (loading && playlist.slides.length === 0) {
    return (
      <div className="w-screen h-screen flex items-center justify-center bg-background text-gray-600">
        <p className="text-xl tracking-wide">Loading signage playlist...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-background text-gray-700 px-8">
        <h1 className="text-3xl font-semibold mb-4 text-gray-900">Configuration Error</h1>
        <p className="max-w-xl text-center text-gray-600 mb-4">{error}</p>
        <p className="text-sm text-gray-500">
          Ensure <span className="font-mono">WORKSPACE/{selectedTeam}/playlist.json</span> exists and is valid JSON.
        </p>
      </div>
    );
  }

  if (!playlist.slides || playlist.slides.length === 0) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-background text-gray-600">
        <h1 className="text-3xl font-semibold mb-4 text-gray-900">No Slides Available</h1>
        <p className="max-w-xl text-center">
          No slides in playlist. Edit <span className="font-mono">WORKSPACE/{selectedTeam}/playlist.json</span> and add slides (images in <span className="font-mono">photos/</span>, etc.).
        </p>
      </div>
    );
  }

  return (
    <div className="w-screen h-screen bg-background text-gray-800 overflow-hidden">
      <div className="h-full w-full flex flex-col">
        <header className="flex items-center justify-between shrink-0 px-4 py-3">
          <div className="flex items-center gap-8">
            <AumovioLogo className="h-8 w-auto" textColor="#111827" />
            <div className="h-8 w-px bg-gray-300" />
            <div>
              <p className="text-lg font-semibold text-gray-900">{greeting}!</p>
              <p className="text-sm text-gray-500">
                Live information wall for teams, guests, and leadership.
              </p>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2 text-sm text-gray-600">
            <div className="flex flex-col items-end">
              <span className="uppercase tracking-[0.2em] text-xs text-gray-400">Department</span>
              <span className="font-medium text-gray-800">{selectedTeam}</span>
            </div>
            <button
              type="button"
              onClick={async () => {
                if (window.api?.setSelectedTeam) {
                  await window.api.setSelectedTeam(null);
                  setSelectedTeam(null);
                }
              }}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100"
            >
              Change department
            </button>
            <button
              type="button"
              onClick={() => window.api?.quitApp?.()}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-colors"
              title="Shut down"
            >
              <span className="text-lg" aria-hidden>⏻</span>
            </button>
          </div>
        </header>

        <main className="flex-1 grid grid-cols-[minmax(0,1fr)_minmax(0,320px)] gap-4 min-h-0 px-4 pb-4">
          <section className="flex flex-col gap-4 min-h-0">
            <div className="flex-1 rounded-2xl bg-surface border border-gray-200 shadow-sm overflow-hidden min-h-0">
              <SlidePlayer slides={playlist.slides} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-surface border border-gray-200 shadow-sm px-4 py-3 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs uppercase tracking-[0.2em] text-gray-500">Visitors</span>
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                </div>
                <p className="text-3xl font-semibold mb-1 text-gray-900">24</p>
                <p className="text-xs text-gray-500">Checked in today</p>
              </div>

              <div className="rounded-2xl bg-surface border border-gray-200 shadow-sm px-4 py-3 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs uppercase tracking-[0.2em] text-gray-500">Meeting rooms</span>
                  <span className="text-[0.7rem] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">Live</span>
                </div>
                <p className="text-3xl font-semibold mb-1 text-gray-900">7 / 10</p>
                <p className="text-xs text-gray-500">Currently occupied</p>
              </div>
            </div>
          </section>

          <aside className="flex flex-col gap-3 min-h-0 content-start">
            <div className="rounded-2xl bg-surface border border-gray-200 shadow-sm px-4 py-3 w-full shrink-0">
              <Clock />
            </div>
            <div className="rounded-2xl bg-surface border border-gray-200 shadow-sm px-4 py-3 w-full shrink-0">
              <WeatherPanel />
            </div>
            <div className="rounded-2xl bg-surface border border-gray-200 shadow-sm px-4 py-3 w-full shrink-0">
              <InfoCarousel />
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}

export default App;
