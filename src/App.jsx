import React, { useEffect, useState } from 'react';
import SlidePlayer from './components/SlidePlayer.jsx';
import Clock from './components/Clock.jsx';
import WeatherPanel from './components/WeatherPanel.jsx';
import InfoCarousel from './components/InfoCarousel.jsx';
import CanteenRestaurantBlock from './components/CanteenRestaurantBlock.jsx';
import StatusDashboard from './components/StatusDashboard.jsx';
import VisitorsCarousel from './components/VisitorsCarousel.jsx';
import AumovioLogo from './components/AumovioLogo.jsx';
import TeamSelection from './components/TeamSelection.jsx';
import StretchingPopup from './components/StretchingPopup.jsx';
import CanteenMenuPopup from './components/CanteenMenuPopup.jsx';

function App() {
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teamCheckDone, setTeamCheckDone] = useState(false);
  const [playlist, setPlaylist] = useState({ slides: [] });
  const [sectionsContent, setSectionsContent] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => new Date());
  const [canteenMenuPopupVisible, setCanteenMenuPopupVisible] = useState(false);
  const [canteenMenuPopupDuration, setCanteenMenuPopupDuration] = useState(15);
  const [canteenMenuLoadFailed, setCanteenMenuLoadFailed] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!window.api?.onCanteenMenuShow || !window.api?.onCanteenMenuLoadFailed) return;
    const unshow = window.api.onCanteenMenuShow((payload) => {
      setCanteenMenuLoadFailed(false);
      setCanteenMenuPopupDuration(payload?.durationMinutes ?? 15);
      setCanteenMenuPopupVisible(true);
    });
    const unfail = window.api.onCanteenMenuLoadFailed(() => {
      setCanteenMenuLoadFailed(true);
    });
    return () => {
      if (typeof unshow === 'function') unshow();
      if (typeof unfail === 'function') unfail();
    };
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

  const loadSections = async () => {
    if (!selectedTeam || !window.api?.getAllSectionsContent) return;
    try {
      const data = await window.api.getAllSectionsContent(selectedTeam);
      setSectionsContent(data || {});
    } catch (e) {
      setSectionsContent({});
    }
  };

  useEffect(() => {
    if (!selectedTeam) return;
    loadPlaylist();
    loadSections();
    let unsubscribe;
    if (window.api?.onPlaylistUpdated) {
      unsubscribe = window.api.onPlaylistUpdated(() => {
        loadPlaylist();
        loadSections();
      });
    }
    const REFRESH_MS = 60 * 1000;
    const interval = setInterval(() => {
      try {
        loadPlaylist();
        loadSections();
      } catch (e) {
        console.error('[App] Refresh interval error:', e);
      }
    }, REFRESH_MS);
    return () => {
      clearInterval(interval);
      if (typeof unsubscribe === 'function') unsubscribe();
    };
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
    <div className="w-screen h-screen max-h-[100vh] bg-background text-gray-800 overflow-hidden flex flex-col">
      <header className="flex items-center justify-between shrink-0 px-3 py-2 h-[10vh] min-h-[48px] max-h-[80px]">
        <div className="flex items-center gap-4 sm:gap-6">
          <AumovioLogo className="h-6 w-auto sm:h-8" textColor="#111827" />
          <div className="h-6 w-px bg-gray-300 sm:h-8" />
          <div className="min-w-0">
            <p className="text-base font-semibold text-gray-900 truncate sm:text-lg">{greeting}!</p>
            <p className="text-xs text-gray-500 truncate sm:text-sm">
              Live information wall for teams, guests, and leadership.
            </p>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-2 text-sm text-gray-600 shrink-0">
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
              onClick={() => window.api?.openAdminWindow?.()}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-200 text-gray-600 hover:bg-gray-300 transition-colors"
              title="Admin"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
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

      <main className="flex-1 min-h-0 grid grid-cols-[minmax(0,3fr)_minmax(0,0.92fr)] gap-2 sm:gap-3 px-2 pb-2 sm:px-4 sm:pb-4 overflow-hidden">
        <section className="flex flex-col gap-2 sm:gap-3 min-h-0 min-w-0 overflow-hidden">
          <div className="flex-[5] min-h-0 rounded-xl sm:rounded-2xl bg-surface border border-gray-200 shadow-sm overflow-hidden">
            <SlidePlayer slides={playlist.slides} />
          </div>
          <div className="flex-[1] min-h-0 grid grid-cols-2 gap-2 sm:gap-3 overflow-hidden">
            <div className="min-w-0 min-h-0 flex flex-col overflow-hidden">
              <VisitorsCarousel sections={sectionsContent} />
            </div>
            <div className="min-w-0 min-h-0 flex flex-col overflow-hidden">
              <StatusDashboard sections={sectionsContent} />
            </div>
          </div>
        </section>

        <aside className="flex flex-col gap-2 sm:gap-3 min-h-0 min-w-0 overflow-y-auto">
          <div className="shrink-0 rounded-xl sm:rounded-2xl bg-surface border border-gray-200 shadow-sm px-4 py-3 w-full">
            <Clock />
          </div>
          <div className="flex-[1.35] min-h-0 rounded-xl sm:rounded-2xl bg-surface border border-gray-200 shadow-sm px-3 py-2 sm:px-4 sm:py-3 w-full overflow-hidden flex flex-col">
            <WeatherPanel announcements={sectionsContent.announcements} />
          </div>
          <div className="flex-[0.74] min-h-0 max-h-[33vh] rounded-xl sm:rounded-2xl bg-surface border border-gray-200 shadow-sm px-2 py-1.5 sm:px-3 sm:py-2 w-full overflow-hidden flex flex-col">
            <InfoCarousel sections={sectionsContent} />
          </div>
          <div className="shrink-0 rounded-xl sm:rounded-2xl bg-surface border border-gray-200 shadow-sm px-2 py-1.5 sm:px-3 sm:py-2 w-full">
            <CanteenRestaurantBlock
              canteenMenu={sectionsContent.canteen_menu}
              traffic={sectionsContent.traffic}
              menuLoadFailed={canteenMenuLoadFailed}
            />
          </div>
        </aside>
      </main>
      <StretchingPopup sections={sectionsContent} now={now} />
      <CanteenMenuPopup
        visible={canteenMenuPopupVisible}
        durationMinutes={canteenMenuPopupDuration}
        onClose={() => setCanteenMenuPopupVisible(false)}
      />
    </div>
  );
}

export default App;
