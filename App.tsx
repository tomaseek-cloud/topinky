
import React, { useState, useEffect, useTransition, useCallback } from 'react';
import { INITIAL_DATA } from './data';
import { DiamondIcon } from './constants';
import { Scout, Game, AppSettings, Area, ActivityStatus, TrailLevel, UserRole } from './types';
import Dashboard from './components/Dashboard';
import Stezka from './components/Stezka';
import Leaderboard from './components/Leaderboard';
import Admin from './components/Admin';
import GameView from './components/GameView';
import Login from './components/Login';
import Gallery from './components/Gallery';

const App: React.FC = () => {
  const [isPending, startTransition] = useTransition();
  const [showLevelSelector, setShowLevelSelector] = useState(false);
  
  // Načítání role a ID skauta
  const [userRole, setUserRole] = useState<UserRole | null>(() => {
    const saved = localStorage.getItem('userRole');
    return (saved === 'admin' || saved === 'leader' || saved === 'user') ? saved as UserRole : null;
  });
  
  const [currentScoutId, setCurrentScoutId] = useState<string | null>(() => {
    return localStorage.getItem('currentScoutId');
  });

  const [activeTab, setActiveTab] = useState<'home' | 'stezka' | 'gallery' | 'game' | 'leaderboard' | 'admin'>('home');
  
  // CENTRÁLNÍ STAV - Vše se odvíjí od INITIAL_DATA z data.ts
  const [scouts, setScouts] = useState<Scout[]>(() => {
    const saved = localStorage.getItem('scouts');
    return saved ? JSON.parse(saved) : INITIAL_DATA.scouts;
  });

  const [customLevels, setCustomLevels] = useState<TrailLevel[]>(() => {
    const saved = localStorage.getItem('customLevels');
    return saved ? JSON.parse(saved) : INITIAL_DATA.trailLevels;
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('settings');
    return saved ? { ...INITIAL_DATA.settings, ...JSON.parse(saved) } : INITIAL_DATA.settings;
  });

  const [games, setGames] = useState<Game[]>(() => {
    const saved = localStorage.getItem('games');
    return saved ? JSON.parse(saved) : [];
  });

  // Automatické ukládání do localStorage (simulace databáze v prohlížeči)
  useEffect(() => { localStorage.setItem('scouts', JSON.stringify(scouts)); }, [scouts]);
  useEffect(() => { localStorage.setItem('games', JSON.stringify(games)); }, [games]);
  useEffect(() => { localStorage.setItem('settings', JSON.stringify(settings)); }, [settings]);
  useEffect(() => { localStorage.setItem('customLevels', JSON.stringify(customLevels)); }, [customLevels]);
  
  useEffect(() => { 
    if (userRole) localStorage.setItem('userRole', userRole);
    else localStorage.removeItem('userRole');
  }, [userRole]);

  useEffect(() => {
    if (currentScoutId) localStorage.setItem('currentScoutId', currentScoutId);
    else localStorage.removeItem('currentScoutId');
  }, [currentScoutId]);

  // Handlery pro aktualizaci dat
  const handleUpdateScouts = useCallback((updatedScouts: Scout[]) => setScouts(updatedScouts), []);
  const handleUpdateGames = useCallback((updatedGames: Game[]) => setGames(updatedGames), []);
  const handleUpdateSettings = useCallback((updatedSettings: AppSettings) => setSettings(updatedSettings), []);
  const handleUpdateStezka = useCallback((updatedAreas: Area[]) => {
    setCustomLevels(prev => prev.map(level => 
      level.id === settings.activeLevelId ? { ...level, areas: updatedAreas } : level
    ));
  }, [settings.activeLevelId]);

  const handleTabChange = (tab: any) => startTransition(() => setActiveTab(tab));

  const signActivity = (activityId: string, scoutId: string) => {
    if (scoutId === 'admin-scout') return;
    let pointsToAdd = 0;
    let targetLevelId = settings.activeLevelId;

    customLevels.forEach(level => {
      level.areas.forEach(area => {
        area.subcategories.forEach(sub => {
          const act = sub.activities.find(a => a.id === activityId);
          if (act) {
            pointsToAdd = act.pointsValue || (act.isMandatory ? settings.scoring.mandatoryTask : settings.scoring.optionalTask);
            targetLevelId = level.id;
          }
        });
      });
    });

    setScouts(prev => prev.map(s => {
      if (s.id === scoutId) {
        if (s.activitiesProgress[activityId] === 'signed') return s;
        return {
          ...s,
          pointsByLevel: { ...s.pointsByLevel, [targetLevelId]: (s.pointsByLevel[targetLevelId] || 0) + pointsToAdd },
          activitiesProgress: { ...s.activitiesProgress, [activityId]: 'signed' as ActivityStatus },
          activityCompletionDates: { ...s.activityCompletionDates, [activityId]: new Date().toISOString() }
        };
      }
      return s;
    }));
  };

  const activeScout = scouts.find(s => s.id === currentScoutId);
  const isManagement = userRole === 'admin' || userRole === 'leader';
  
  if (!userRole || (userRole === 'user' && !activeScout)) {
    return <Login scouts={scouts} onLogin={(role, id) => {
      setUserRole(role);
      setCurrentScoutId(id || null);
      handleTabChange('home');
    }} onUpdateScouts={handleUpdateScouts} />;
  }

  const effectiveScout = (userRole === 'admin' && !currentScoutId) ? {
    id: 'admin-scout', nickname: settings.adminProfile?.nickname || 'Admin', avatar: settings.adminProfile?.avatar || '⚙️', role: 'admin' as UserRole, pointsByLevel: {}, activitiesProgress: {}, activityCompletionDates: {}, completedActivities: [], unlockedLevels: customLevels.map(l => l.id)
  } : activeScout!;

  const currentLevel = customLevels.find(l => l.id === settings.activeLevelId) || customLevels[0];

  return (
    <div className="min-h-screen flex flex-col max-w-2xl mx-auto bg-[#fcfaf2] shadow-2xl relative">
      <header className="text-white p-5 sticky top-0 z-50 shadow-lg flex justify-between items-center" style={{ backgroundColor: currentLevel.color }}>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowLevelSelector(!showLevelSelector)} className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center hover:scale-105 transition-transform">
             <DiamondIcon color="#ffffff" className="w-7 h-7" />
          </button>
          <div>
            <h1 className="text-lg font-bold parchment-font uppercase leading-none">{currentLevel.name}</h1>
            <p className="text-[9px] opacity-70 font-medium tracking-[0.2em] uppercase mt-1">
              {userRole === 'admin' ? '⚙️ ADMIN' : userRole === 'leader' ? `🎖️ VEDOUCÍ` : `🧭 ${effectiveScout.nickname}`}
            </p>
          </div>
        </div>
        <button onClick={() => { setUserRole(null); setCurrentScoutId(null); }} className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-xs">🚪</button>
      </header>

      <main className={`flex-1 overflow-y-auto pb-24 ${isPending ? 'opacity-50' : 'opacity-100'}`}>
        {activeTab === 'home' && <Dashboard settings={settings} games={games} scouts={scouts} currentScoutId={currentScoutId} userRole={userRole} onUpdateScouts={handleUpdateScouts} onUpdateSettings={handleUpdateSettings} areas={currentLevel.areas} />}
        {activeTab === 'stezka' && <Stezka level={currentLevel} scouts={scouts} currentScoutId={currentScoutId} userRole={userRole} settings={settings} onSignActivity={(actId) => signActivity(actId, isManagement && !currentScoutId ? 'admin-scout' : (currentScoutId || ''))} onUpdateScouts={handleUpdateScouts} leaderSecret={settings.leaderSecret} />}
        {activeTab === 'gallery' && <Gallery settings={settings} userRole={userRole} currentScoutId={currentScoutId} scouts={scouts} onUpdateSettings={handleUpdateSettings} />}
        {activeTab === 'game' && <GameView settings={settings} onUpdateSettings={handleUpdateSettings} currentScout={effectiveScout as Scout} />}
        {activeTab === 'leaderboard' && <Leaderboard scouts={scouts} levelId={settings.activeLevelId} settings={settings} games={games} areas={currentLevel.areas} />}
        {activeTab === 'admin' && isManagement && <Admin settings={settings} onUpdateSettings={handleUpdateSettings} games={games} onUpdateGames={handleUpdateGames} scouts={scouts} onUpdateScouts={handleUpdateScouts} stezkaAreas={currentLevel.areas} onUpdateStezka={handleUpdateStezka} userRole={userRole} />}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 max-w-2xl mx-auto bg-white border-t h-20 flex items-center justify-around z-50">
        {[
          { id: 'home', icon: '🏠', label: 'Domů' },
          { id: 'stezka', icon: '🧭', label: 'Stezka' },
          { id: 'gallery', icon: '📸', label: 'Kronika' },
          { id: 'game', icon: '🎮', label: 'Hra' },
          { id: 'leaderboard', icon: '🏆', label: 'Body' },
          ...(isManagement ? [{ id: 'admin', icon: '⚙️', label: 'Admin' }] : [])
        ].map(tab => (
          <button key={tab.id} onClick={() => handleTabChange(tab.id)} className={`flex flex-col items-center flex-1 py-2 ${activeTab === tab.id ? 'font-bold' : 'text-gray-400'}`} style={activeTab === tab.id ? { color: currentLevel.color } : {}}>
            <span className={`text-xl mb-1 ${activeTab === tab.id ? 'scale-125' : ''}`}>{tab.icon}</span>
            <span className="text-[9px] uppercase font-bold tracking-widest">{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default App;
