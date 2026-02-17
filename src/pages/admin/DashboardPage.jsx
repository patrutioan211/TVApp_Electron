import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext.jsx';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [teams, setTeams] = useState([]);
  const [newTeamName, setNewTeamName] = useState('');
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [playlist, setPlaylist] = useState({ slides: [] });
  const [saveStatus, setSaveStatus] = useState('');
  const [loading, setLoading] = useState(true);

  const loadTeams = async () => {
    if (!window.api?.getTeams) return;
    const list = await window.api.getTeams();
    setTeams(list || []);
  };

  useEffect(() => {
    loadTeams().finally(() => setLoading(false));
  }, []);


  useEffect(() => {
    if (!selectedTeam || !window.api?.getPlaylistForTeam) return;
    window.api.getPlaylistForTeam(selectedTeam).then((data) => {
      const raw = data?.slides ?? [];
      const slides = raw.map((s) => {
        if ((s.type || '').toLowerCase() === 'social_media') {
          const { posts, ...rest } = s;
          return { ...rest, type: 'web_url', src: s.src || '' };
        }
        return s;
      });
      setPlaylist({ slides });
    });
  }, [selectedTeam]);

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    const name = newTeamName.trim();
    if (!name) return;
    const res = await window.api.adminCreateTeam(name);
    if (res.ok) {
      setNewTeamName('');
      await loadTeams();
    } else {
      alert(res.error || 'Eroare la creare');
    }
  };

  const handleDeleteTeam = async (name) => {
    if (!confirm(`Ștergi echipa "${name}" și tot conținutul?`)) return;
    const res = await window.api.adminDeleteTeam(name);
    if (res.ok) {
      if (selectedTeam === name) setSelectedTeam(null);
      await loadTeams();
    } else {
      alert(res.error || 'Eroare la ștergere');
    }
  };

  const handleSavePlaylist = async () => {
    if (!selectedTeam) return;
    setSaveStatus('Se salvează…');
    const toSave = {
      ...playlist,
      slides: (playlist.slides || []).map((s) => ({
        ...s,
        src: (s.src || '').replace(/^workspace:\/\/\.?\//, '')
      }))
    };
    const res = await window.api.adminSavePlaylist(selectedTeam, toSave);
    setSaveStatus(res.ok ? 'Salvat.' : (res.error || 'Eroare'));
    if (res.ok) setTimeout(() => setSaveStatus(''), 2000);
  };

  const addSlide = () => {
    setPlaylist((p) => ({
      ...p,
      slides: [...(p.slides || []), { id: `slide-${Date.now()}`, type: 'web_url', src: 'https://', duration: 10, title: '', subtitle: '' }]
    }));
  };

  const removeSlide = (id) => {
    setPlaylist((p) => ({ ...p, slides: (p.slides || []).filter((s) => s.id !== id) }));
  };

  const updateSlide = (id, field, value) => {
    setPlaylist((p) => ({
      ...p,
      slides: (p.slides || []).map((s) => (s.id === id ? { ...s, [field]: value } : s))
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Admin – Panou de control</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{user?.email}</span>
          <button
            type="button"
            onClick={logout}
            className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100"
          >
            Deconectare
          </button>
        </div>
      </header>

      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Echipe (WORKSPACE)</h2>
          {loading ? (
            <p className="text-gray-500">Se încarcă…</p>
          ) : (
            <>
              <form onSubmit={handleCreateTeam} className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="Nume echipă nouă"
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                />
                <button type="submit" className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800">
                  Adaugă
                </button>
              </form>
              <ul className="space-y-2">
                {teams.map((name) => (
                  <li key={name} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <button
                      type="button"
                      onClick={() => setSelectedTeam(name)}
                      className={`flex-1 text-left font-medium ${selectedTeam === name ? 'text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}
                    >
                      {name}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteTeam(name)}
                      className="text-red-500 hover:text-red-700 text-sm px-2"
                    >
                      Șterge
                    </button>
                  </li>
                ))}
                {teams.length === 0 && <p className="text-gray-500 text-sm">Nicio echipă. Adaugă una mai sus.</p>}
              </ul>
            </>
          )}
        </section>

        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Playlist {selectedTeam ? `– ${selectedTeam}` : ''}
          </h2>
          {!selectedTeam ? (
            <p className="text-gray-500 text-sm">Selectează o echipă pentru a edita playlist-ul.</p>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-gray-500">{saveStatus}</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={addSlide}
                    className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm hover:bg-gray-50"
                  >
                    + Slide
                  </button>
                  <button
                    type="button"
                    onClick={handleSavePlaylist}
                    className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-sm hover:bg-gray-800"
                  >
                    Salvează
                  </button>
                </div>
              </div>
              <ul className="space-y-3 max-h-96 overflow-y-auto">
                {(playlist.slides || []).map((slide, i) => (
                  <li key={slide.id} className="p-3 rounded-lg border border-gray-200 bg-gray-50">
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-xs font-medium text-gray-500">#{i + 1} {slide.type || 'slide'}</span>
                      <button type="button" onClick={() => removeSlide(slide.id)} className="text-red-500 text-xs hover:underline">
                        Elimină
                      </button>
                    </div>
                    <input
                      value={slide.src || ''}
                      onChange={(e) => updateSlide(slide.id, 'src', e.target.value)}
                      placeholder={(slide.type || '') === 'powerbi' ? 'https://app.powerbi.com/view?r=...' : 'src (URL sau cale)'}
                      className="w-full mt-1 text-sm rounded border border-gray-300 px-2 py-1"
                    />
                    {(slide.type || '') === 'powerbi' && (
                      <input
                        value={slide.powerBiPage || ''}
                        onChange={(e) => updateSlide(slide.id, 'powerBiPage', e.target.value)}
                        placeholder="Pagină report (pageName, opțional)"
                        className="w-full mt-1 text-sm rounded border border-gray-300 px-2 py-1"
                      />
                    )}
                    <div className="flex gap-2 mt-1 flex-wrap items-center">
                      <select
                        value={slide.type || 'web_url'}
                        onChange={(e) => updateSlide(slide.id, 'type', e.target.value)}
                        className="text-sm rounded border border-gray-300 px-2 py-1"
                      >
                        <option value="web_url">web_url</option>
                        <option value="web_live">web_live</option>
                        <option value="powerbi">powerbi (Power BI)</option>
                        <option value="image">image</option>
                        <option value="video">video</option>
                        <option value="vimeo">vimeo</option>
                        <option value="hls">hls</option>
                        <option value="pdf">pdf</option>
                      </select>
                      <input
                        type="number"
                        value={slide.duration || 10}
                        onChange={(e) => updateSlide(slide.id, 'duration', Number(e.target.value) || 10)}
                        placeholder="durata (s)"
                        className="w-20 text-sm rounded border border-gray-300 px-2 py-1"
                      />
                      {(slide.type || '') === 'web_live' && (
                        <label className="flex items-center gap-1.5 text-sm">
                          <span className="text-gray-500">Zoom fit %:</span>
                          <select
                            value={slide.webLiveFit ?? 250}
                            onChange={(e) => updateSlide(slide.id, 'webLiveFit', Number(e.target.value))}
                            className="text-sm rounded border border-gray-300 px-2 py-1"
                          >
                            <option value={50}>50% (zoom in)</option>
                            <option value={75}>75% (zoom in)</option>
                            <option value={100}>100% (1:1)</option>
                            <option value={150}>150% (scale 0.67)</option>
                            <option value={200}>200% (scale 0.5)</option>
                            <option value={250}>250% (scale 0.4)</option>
                            <option value={300}>300% (scale 0.33)</option>
                            <option value={400}>400% (scale 0.25)</option>
                          </select>
                        </label>
                      )}
                      {(slide.type || '') === 'powerbi' && (
                        <label className="flex items-center gap-1.5 text-sm">
                          <span className="text-gray-500">Zoom fit %:</span>
                          <select
                            value={slide.powerBiFit ?? 100}
                            onChange={(e) => updateSlide(slide.id, 'powerBiFit', Number(e.target.value))}
                            className="text-sm rounded border border-gray-300 px-2 py-1"
                          >
                            <option value={50}>50% (zoom in)</option>
                            <option value={75}>75% (zoom in)</option>
                            <option value={100}>100% (1:1)</option>
                            <option value={150}>150%</option>
                            <option value={200}>200%</option>
                            <option value={250}>250%</option>
                            <option value={300}>300%</option>
                            <option value={400}>400%</option>
                          </select>
                        </label>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
