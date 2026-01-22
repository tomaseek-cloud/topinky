
import React, { useState, useEffect, useMemo } from 'react';
// Fix: Added UserRole to imports
import { AppSettings, Game, Scout, Area, Meeting, Bonus, AttendanceStatus, UserRole } from '../types';
import { ALL_AVATARS, GreenDiamond } from '../constants';

interface Props {
  settings: AppSettings;
  games: Game[];
  scouts: Scout[];
  currentScoutId: string | null;
  // Fix: Changed 'admin' | 'user' | null to UserRole | null
  userRole: UserRole | null;
  onUpdateScouts: (scouts: Scout[]) => void;
  onUpdateSettings: (settings: AppSettings) => void;
  areas: Area[];
}

interface HistoryItem {
  id: string;
  type: 'task' | 'game' | 'attendance' | 'bonus';
  title: string;
  points: number;
  date?: string;
  icon: string | React.ReactNode;
}

const Dashboard: React.FC<Props> = ({ settings, games, scouts, currentScoutId, userRole, onUpdateScouts, onUpdateSettings, areas }) => {
  const activeLevelId = settings.activeLevelId;
  const isAdmin = userRole === 'admin';

  // Identita uživatele
  const currentUser: Scout | { nickname: string, avatar: string, id: string, pointsByLevel: any, isProfileLocked?: boolean } = useMemo(() => {
    if (isAdmin) {
      return {
        id: 'admin-scout',
        nickname: settings.adminProfile?.nickname || 'Admin',
        avatar: settings.adminProfile?.avatar || '⚙️',
        pointsByLevel: {},
        isProfileLocked: false
      };
    }
    return scouts.find(s => s.id === currentScoutId) || scouts[0];
  }, [isAdmin, scouts, currentScoutId, settings.adminProfile]);

  const levelPoints = currentUser.pointsByLevel[activeLevelId] || 0;

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [newNickname, setNewNickname] = useState(currentUser.nickname);
  const [selectedAvatar, setSelectedAvatar] = useState(currentUser.avatar);
  const [timeLeft, setTimeLeft] = useState({ d: 0, h: 0, m: 0, s: 0 });

  const getNextMeeting = () => {
    const now = new Date();
    return settings.meetings
      .filter(m => new Date(m.date) > now)
      // Fix: Changed 'm' to 'b' in sort function to correct the reference error
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
  };

  const getPastMeetings = () => {
    const now = new Date();
    return settings.meetings
      .filter(m => new Date(m.date) <= now)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const pointsHistory = useMemo(() => {
    if (isAdmin) return [];
    const history: HistoryItem[] = [];
    const scout = currentUser as Scout;
    
    areas.forEach(area => {
      area.subcategories.forEach(sub => {
        sub.activities.forEach(act => {
          if (scout.activitiesProgress[act.id] === 'signed') {
            history.push({
              id: `task-${act.id}`,
              type: 'task',
              title: act.title,
              points: act.pointsValue || (act.isMandatory ? settings.scoring.mandatoryTask : settings.scoring.optionalTask),
              icon: '🧭',
            });
          }
        });
      });
    });

    (settings.bonuses || []).forEach(bonus => {
      if (bonus.scoutId === scout.id && bonus.levelId === activeLevelId) {
        history.push({
          id: `bonus-${bonus.id}`,
          type: 'bonus',
          title: bonus.reason || 'Bonusová odměna',
          points: bonus.points,
          date: bonus.date,
          icon: <GreenDiamond className="w-7 h-7" />,
        });
      }
    });

    games.forEach(game => {
      if (game.levelId !== activeLevelId) return;
      const indResult = game.results.find(r => r.scoutId === scout.id);
      if (indResult && indResult.pointsGained > 0) {
        const meeting = settings.meetings.find(m => m.id === game.meetingId);
        history.push({
          id: `game-ind-${game.id}`,
          type: 'game',
          title: `Hra: ${game.name}`,
          points: indResult.pointsGained,
          date: meeting?.date,
          icon: '🎮',
        });
      }
    });

    return history.sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [isAdmin, currentUser, settings, games, areas, activeLevelId]);

  useEffect(() => {
    const meeting = getNextMeeting();
    if (!meeting) return;
    const timer = setInterval(() => {
      const now = new Date().getTime();
      const target = new Date(meeting.date).getTime();
      const diff = target - now;
      if (diff <= 0) {
        setTimeLeft({ d: 0, h: 0, m: 0, s: 0 });
        return;
      }
      setTimeLeft({
        d: Math.floor(diff / (1000 * 60 * 60 * 24)),
        h: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        m: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        s: Math.floor((diff % (1000 * 60)) / 1000)
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [settings.meetings]);

  const saveProfile = () => {
    if (currentUser.isProfileLocked) return;
    
    if (isAdmin) {
      onUpdateSettings({
        ...settings,
        adminProfile: { nickname: newNickname, avatar: selectedAvatar }
      });
    } else {
      onUpdateScouts(scouts.map(s => s.id === currentUser.id ? { ...s, nickname: newNickname, avatar: selectedAvatar } : s));
    }
    setIsEditingProfile(false);
  };

  const nextMeeting = getNextMeeting();
  const pastMeetings = getPastMeetings();

  const renderMeetingContent = (meeting: Meeting) => {
    const meetingGames = games.filter(g => g.meetingId === meeting.id && g.levelId === activeLevelId);
    const attendees = scouts.filter(s => meeting.attendance?.[s.id] && meeting.attendance[s.id] !== 'absent');

    return (
      <div className="space-y-4 pt-4 border-t border-gray-100 mt-4 animate-fadeIn">
        {meetingGames.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-[10px] font-black text-[#3b5a3b] uppercase tracking-widest">Hry (Stupeň {activeLevelId})</h4>
            <div className="grid gap-2">
              {meetingGames.map(game => (
                <div key={game.id} className="bg-gray-50/50 p-3 rounded-2xl border border-gray-100">
                  <p className="text-xs font-bold text-gray-700">{game.name}</p>
                  <div className="flex gap-2 overflow-x-auto mt-2 pb-1 scrollbar-hide">
                    {game.results.sort((a,b) => b.pointsGained - a.pointsGained).map(res => {
                      const scout = scouts.find(s => s.id === res.scoutId);
                      return res.pointsGained > 0 && scout ? (
                        <div key={res.scoutId} className="bg-white px-2 py-1 rounded-lg border border-gray-100 flex items-center gap-1 shrink-0">
                          <span className="text-[10px]">{scout.avatar}</span>
                          <span className="text-[9px] font-bold text-[#3b5a3b]">{res.pointsGained} b.</span>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Kdo dorazil ({attendees.length})</h4>
          <div className="grid grid-cols-2 gap-2">
            {attendees.map(s => (
              <div key={s.id} className="bg-white px-3 py-2 rounded-2xl border border-gray-100 flex items-center gap-2 shadow-sm">
                <span className="text-lg bg-gray-50 w-8 h-8 flex items-center justify-center rounded-xl shrink-0">{s.avatar}</span>
                <span className="text-[10px] font-black text-gray-700 uppercase tracking-tight truncate">{s.nickname}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-8 animate-fadeIn text-black">
      <section className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-gray-100 flex items-center gap-5 relative">
        <div className="w-20 h-20 rounded-3xl bg-[#3b5a3b]/5 flex items-center justify-center text-4xl shadow-inner border border-[#3b5a3b]/10 shrink-0">{currentUser.avatar}</div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-gray-800 truncate">{currentUser.nickname}</h2>
          <div className="flex items-center gap-4 mt-3">
             {!isAdmin ? (
               <button 
                  onClick={() => setShowHistory(true)}
                  className="bg-[#3b5a3b]/5 px-3 py-1.5 rounded-xl border border-[#3b5a3b]/10 flex items-center gap-2 active:scale-95 transition-transform"
               >
                  <GreenDiamond className="w-5 h-5" />
                  <span className="text-sm font-black text-[#3b5a3b]">{levelPoints} <span className="text-[10px] font-bold opacity-60">b.</span></span>
               </button>
             ) : (
               <div className="bg-gray-100 px-3 py-1.5 rounded-xl border border-gray-200 flex items-center gap-2">
                  <span className="text-[9px] font-black text-gray-400 uppercase">Administrace oddílu</span>
               </div>
             )}
             <button onClick={() => {
               setNewNickname(currentUser.nickname);
               setSelectedAvatar(currentUser.avatar);
               setIsEditingProfile(true);
             }} className="text-[10px] text-gray-400 font-bold uppercase tracking-wider hover:text-[#3b5a3b] active:scale-95 transition-colors">Upravit</button>
          </div>
        </div>
      </section>

      {isAdmin && (
        <section className="grid grid-cols-2 gap-4">
           <div className="bg-white p-4 rounded-[2rem] border border-gray-100 shadow-sm text-center">
              <p className="text-[9px] font-black text-gray-400 uppercase mb-1">Počet členů</p>
              <p className="text-2xl font-black text-[#3b5a3b]">{scouts.length}</p>
           </div>
           <div className="bg-white p-4 rounded-[2rem] border border-gray-100 shadow-sm text-center">
              <p className="text-[9px] font-black text-gray-400 uppercase mb-1">Aktivní stupeň</p>
              <p className="text-[10px] font-black text-[#3b5a3b] uppercase tracking-tighter">{activeLevelId}</p>
           </div>
        </section>
      )}

      {nextMeeting && (
        <section className="bg-[#3b5a3b] text-white rounded-[3rem] p-8 shadow-xl">
          <header className="space-y-1 mb-6">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] opacity-60">Příští akce začíná za</h3>
            <p className="text-sm font-bold parchment-font italic leading-snug">{nextMeeting.notes || "Připrav se na dobrodružství!"}</p>
          </header>
          <div className="flex justify-between items-center gap-2">
            {[ { label: 'Dny', val: timeLeft.d }, { label: 'Hod', val: timeLeft.h }, { label: 'Min', val: timeLeft.m }, { label: 'Sek', val: timeLeft.s } ].map((unit, i) => (
              <React.Fragment key={unit.label}>
                <div className="flex flex-col items-center flex-1">
                  <span className="text-3xl font-black parchment-font tabular-nums">{unit.val.toString().padStart(2, '0')}</span>
                  <span className="text-[8px] uppercase font-bold tracking-widest opacity-50 mt-1">{unit.label}</span>
                </div>
                {i < 3 && <span className="text-2xl opacity-20 font-black mb-4">:</span>}
              </React.Fragment>
            ))}
          </div>
          {renderMeetingContent(nextMeeting)}
        </section>
      )}

      {pastMeetings.length > 0 && (
        <section className="space-y-4">
           <div className="flex items-center gap-2 px-1"><span className="text-lg">📜</span><h3 className="text-xs font-black text-[#3b5a3b] uppercase tracking-widest">Historie akcí</h3></div>
           <div className="grid gap-3">
              {pastMeetings.map(meeting => (
                <div key={meeting.id} className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden transition-all">
                  <button onClick={() => setExpandedHistoryId(expandedHistoryId === meeting.id ? null : meeting.id)} className="w-full p-5 flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                    <div className="text-left">
                       <p className="text-[10px] font-black text-[#3b5a3b] uppercase tracking-widest">{new Date(meeting.date).toLocaleDateString('cs-CZ')}</p>
                       <h4 className="text-xs font-bold text-gray-700 truncate max-w-[200px]">{meeting.notes || 'Akce'}</h4>
                    </div>
                    <span className={`text-[#3b5a3b] text-xs transition-transform ${expandedHistoryId === meeting.id ? 'rotate-180' : ''}`}>▼</span>
                  </button>
                  {expandedHistoryId === meeting.id && (
                    <div className="px-5 pb-5">
                       {renderMeetingContent(meeting)}
                    </div>
                  )}
                </div>
              ))}
           </div>
        </section>
      )}

      {showHistory && !isAdmin && (
        <div className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-md flex items-end justify-center">
           <div className="bg-[#fcfaf2] w-full max-w-2xl rounded-t-[3rem] p-8 max-h-[85vh] overflow-y-auto shadow-2xl animate-fadeIn scrollbar-hide">
              <div className="flex justify-between items-start mb-8 text-black">
                 <div>
                    <h3 className="text-2xl font-bold parchment-font text-[#3b5a3b]">Body: {settings.activeLevelId}</h3>
                    <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest mt-1">V tomto stupni máš {levelPoints} bodů</p>
                 </div>
                 <button onClick={() => setShowHistory(false)} className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center text-xl">✕</button>
              </div>
              <div className="space-y-3 text-black">
                 {pointsHistory.length === 0 ? (
                   <p className="text-center py-20 text-gray-400 text-xs italic">Zatím jsi v tomto stupni nezískal žádné body.</p>
                 ) : (
                   pointsHistory.map((item, idx) => (
                     <div key={item.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                        <div className="flex items-center gap-4">
                           <span className="text-2xl bg-gray-50 w-12 h-12 flex items-center justify-center rounded-xl">{item.icon}</span>
                           <div>
                              <h4 className="text-xs font-bold text-gray-800 leading-tight">{item.title}</h4>
                              <p className="text-[9px] text-gray-400 font-bold uppercase mt-1">
                                 {item.date ? new Date(item.date).toLocaleDateString('cs-CZ') : 'Splněný úkol'}
                              </p>
                           </div>
                        </div>
                        <div className="bg-[#3b5a3b]/10 px-3 py-1.5 rounded-xl border border-[#3b5a3b]/5">
                           <span className="text-sm font-black text-[#3b5a3b]">+{item.points}</span>
                        </div>
                     </div>
                   ))
                 )}
              </div>
              <button onClick={() => setShowHistory(false)} className="w-full py-4 mt-8 bg-[#3b5a3b] text-white rounded-2xl font-black uppercase text-xs tracking-widest">Zavřít</button>
           </div>
        </div>
      )}

      {isEditingProfile && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-6 text-black">
          <div className="bg-white rounded-[3rem] p-8 w-full max-sm space-y-6 animate-fadeIn shadow-2xl border-t-8 border-[#3b5a3b]">
            <h3 className="text-2xl font-bold parchment-font text-[#3b5a3b] text-center">Můj Profil</h3>
            
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-gray-400 pl-4">Moje Přezdívka</label>
                <input type="text" value={newNickname} onChange={(e) => setNewNickname(e.target.value)} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none font-bold text-black" />
              </div>

              <div className="grid grid-cols-6 gap-2 max-h-40 overflow-y-auto p-2 bg-gray-50 border border-gray-100 rounded-2xl scrollbar-hide">
                {ALL_AVATARS.map(a => (
                  <button key={a} onClick={() => setSelectedAvatar(a)} className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all ${selectedAvatar === a ? 'bg-[#3b5a3b] text-white shadow-lg' : 'hover:bg-white'}`}>{a}</button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button onClick={() => setIsEditingProfile(false)} className="flex-1 py-4 bg-gray-100 text-gray-500 rounded-2xl font-bold uppercase text-xs">Zrušit</button>
              <button onClick={saveProfile} className="flex-1 py-4 bg-[#3b5a3b] text-white rounded-2xl font-bold uppercase text-xs shadow-xl">Uložit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
