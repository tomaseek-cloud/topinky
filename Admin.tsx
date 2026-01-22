
// Fix: Migrated all points calculations and object creation to use the level-specific pointsByLevel and added required levelId fields.
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AppSettings, Game, Scout, Area, Activity, Meeting, AttendanceStatus, Bonus, GameResult, GameTeam, MeetingTeam, Subcategory, Article, UserRole } from '../types';
import { QRCodeSVG } from 'qrcode.react';
import { ALL_AVATARS, DEFAULT_ALBUM_URL } from '../constants';

interface Props {
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
  games: Game[];
  onUpdateGames: (games: Game[]) => void;
  scouts: Scout[];
  onUpdateScouts: (scouts: Scout[]) => void;
  stezkaAreas: Area[];
  onUpdateStezka: (areas: Area[]) => void;
  userRole: UserRole | null;
}

const Admin: React.FC<Props> = ({ 
  settings, 
  onUpdateSettings, 
  games, 
  onUpdateGames, 
  scouts, 
  onUpdateScouts,
  stezkaAreas,
  onUpdateStezka,
  userRole
}) => {
  const [activeAdminTab, setActiveAdminTab] = useState<'qr' | 'meetings' | 'users' | 'tasks' | 'content' | 'chronicle'>('qr');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [qrCodeValue, setQrCodeValue] = useState('');
  const [qrTimeout, setQrTimeout] = useState(30);
  const [expandedMeetingId, setExpandedMeetingId] = useState<string | null>(null);
  const [expandedTaskAreaId, setExpandedTaskAreaId] = useState<string | null>(null);
  const [expandedSignAreaId, setExpandedSignAreaId] = useState<string | null>(null);

  const [deleteConfig, setDeleteConfig] = useState<{ type: string; id: string; title: string; message: string; extra?: any } | null>(null);
  const [editingScout, setEditingScout] = useState<Scout | null>(null);
  const [signingScout, setSigningScout] = useState<Scout | null>(null);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [editingActivity, setEditingActivity] = useState<{areaId: string, subIdx: number, activity: Activity} | null>(null);
  const [editingSubcategory, setEditingSubcategory] = useState<{areaId: string, subIdx: number, title: string} | null>(null);
  const [editingArea, setEditingArea] = useState<{id: string, title: string, icon: string} | null>(null);
  
  const [gameModal, setGameModal] = useState<{meetingId: string, game?: Game} | null>(null);
  const [bulkTaskModal, setBulkTaskModal] = useState<{meetingId: string} | null>(null);
  const [teamRandomizeModal, setTeamRandomizeModal] = useState<{meetingId: string} | null>(null);
  const [bonusModal, setBonusModal] = useState<{meetingId: string} | null>(null);

  const [gameForm, setGameForm] = useState<{
    name: string, 
    type: 'individual' | 'team', 
    teams: GameTeam[],
    results: Record<string, number> 
  }>({ name: '', type: 'individual', teams: [], results: {} });
  
  const [bulkTaskForm, setBulkTaskForm] = useState({ taskId: '', selectedScouts: [] as string[] });
  const [bonusForm, setBonusForm] = useState({ scoutId: '', points: 5, reason: '' });

  const safeSettings: AppSettings = settings || {
    meetings: [],
    leaderSecret: '',
    pdfUrl: '',
    mandatoryPoints: 1,
    optionalPoints: 1,
    scoring: {
      mandatoryTask: 10,
      optionalTask: 5,
      attendancePresent: 10,
      attendanceLate: 5,
      attendanceExcused: 2
    },
    bonuses: [],
    flappyScores: [],
    playTimes: [],
    activeLevelId: 'zeme',
    showTotalLeaderboard: false
  };

  const activeLevelId = safeSettings.activeLevelId;

  const pendingApprovals = useMemo(() => {
    const list: { scout: Scout; activity: Activity; area: Area }[] = [];
    scouts.forEach(s => {
      Object.entries(s.activitiesProgress).forEach(([actId, status]) => {
        if (status === 'done') {
          stezkaAreas.forEach(area => {
            area.subcategories.forEach(sub => {
              const act = sub.activities.find(a => a.id === actId);
              if (act) {
                list.push({ scout: s, activity: act, area });
              }
            });
          });
        }
      });
    });
    return list;
  }, [scouts, stezkaAreas]);

  const allArticles = useMemo(() => {
    const articles: { article: Article, meeting: Meeting }[] = [];
    safeSettings.meetings.forEach(m => {
      if (m.articles) {
        m.articles.forEach(a => {
          articles.push({ article: a, meeting: m });
        });
      }
    });
    return articles.sort((a, b) => new Date(b.article.timestamp).getTime() - new Date(a.article.timestamp).getTime());
  }, [safeSettings.meetings]);

  useEffect(() => {
    if (!safeSettings.leaderSecret) return;
    const generateValue = () => {
      const timestamp = Math.floor(Date.now() / 30000);
      setQrCodeValue(`${safeSettings.leaderSecret}-${timestamp}`);
      setQrTimeout(30);
    };
    generateValue();
    const interval = setInterval(() => setQrTimeout(prev => (prev <= 1 ? 30 : prev - 1)), 1000);
    return () => clearInterval(interval);
  }, [safeSettings.leaderSecret]);

  useEffect(() => {
    if (gameModal) {
      if (gameModal.game) {
        const results: Record<string, number> = {};
        gameModal.game.results.forEach(r => { results[r.teamId || r.scoutId] = r.pointsGained; });
        setGameForm({ 
          name: gameModal.game.name, 
          type: gameModal.game.gameType, 
          teams: gameModal.game.teams || [], 
          results 
        });
      } else {
        setGameForm({ name: '', type: 'individual', teams: [], results: {} });
      }
    }
  }, [gameModal]);

  const exportAllData = () => {
    const dataToExport = { scouts, games, settings: safeSettings, stezkaAreas, version: '1.7.1', exportedAt: new Date().toISOString() };
    const blob = new globalThis.Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `skautska_stezka_export.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const importAllData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        if (confirm("Opravdu přepsat aktuální data?")) {
          onUpdateScouts(imported.scouts);
          onUpdateGames(imported.games || []);
          onUpdateSettings(imported.settings);
          if (imported.stezkaAreas) onUpdateStezka(imported.stezkaAreas);
        }
      } catch (err) { alert("Chyba: " + err); }
    };
    reader.readAsText(file);
    event.target.value = ''; 
  };

  const toggleScoutTaskSignature = (scoutId: string, taskId: string) => {
    const scout = scouts.find(s => s.id === scoutId);
    if (!scout) return;

    const isSigned = scout.activitiesProgress[taskId] === 'signed';
    let pts = 10;
    
    stezkaAreas.forEach(a => a.subcategories.forEach(sub => {
      const act = sub.activities.find(x => x.id === taskId);
      if (act) {
        pts = act.pointsValue || (act.isMandatory ? safeSettings.scoring.mandatoryTask : safeSettings.scoring.optionalTask);
      }
    }));

    const newProgress = { ...scout.activitiesProgress };
    const newCompletionDates = { ...scout.activityCompletionDates };
    const newPointsByLevel = { ...scout.pointsByLevel };
    const currentPoints = newPointsByLevel[activeLevelId] || 0;

    if (isSigned) {
      delete newProgress[taskId];
      delete newCompletionDates[taskId];
      newPointsByLevel[activeLevelId] = Math.max(0, currentPoints - pts);
    } else {
      newProgress[taskId] = 'signed';
      newCompletionDates[taskId] = new Date().toISOString();
      newPointsByLevel[activeLevelId] = currentPoints + pts;
    }

    const updatedScouts = scouts.map(s => s.id === scoutId ? { ...s, pointsByLevel: newPointsByLevel, activitiesProgress: newProgress, activityCompletionDates: newCompletionDates } : s);
    onUpdateScouts(updatedScouts);
    
    if (signingScout && signingScout.id === scoutId) {
      setSigningScout({ ...signingScout, pointsByLevel: newPointsByLevel, activitiesProgress: newProgress, activityCompletionDates: newCompletionDates });
    }
  };

  const randomizeMeetingTeams = (meetingId: string, teamCount: number) => {
    const meeting = safeSettings.meetings.find(m => m.id === meetingId);
    if (!meeting) return;

    const presentScouts = scouts.filter(s => meeting.attendance?.[s.id] === 'present' || meeting.attendance?.[s.id] === 'late');
    if (presentScouts.length === 0) {
      alert("Na schůzce není nikdo přítomen!");
      return;
    }

    const shuffled = [...presentScouts].sort(() => Math.random() - 0.5);
    const newTeams: MeetingTeam[] = Array.from({ length: teamCount }, (_, i) => ({
      name: `Tým ${i + 1}`,
      members: []
    }));

    shuffled.forEach((s, idx) => {
      newTeams[idx % teamCount].members.push(s.id);
    });

    const updatedMeetings = safeSettings.meetings.map(m => m.id === meetingId ? { ...m, teams: newTeams } : m);
    onUpdateSettings({ ...safeSettings, meetings: updatedMeetings });
    setTeamRandomizeModal(null);
  };

  const moveScoutBetweenTeams = (meetingId: string, scoutId: string, targetTeamName: string) => {
    const updatedMeetings = safeSettings.meetings.map(m => {
      if (m.id !== meetingId || !m.teams) return m;
      
      const newTeams = m.teams.map(team => ({
        ...team,
        members: team.members.filter(id => id !== scoutId)
      }));
      
      const targetTeam = newTeams.find(t => t.name === targetTeamName);
      if (targetTeam) {
        targetTeam.members.push(scoutId);
      }
      
      return { ...m, teams: newTeams };
    });
    
    onUpdateSettings({ ...safeSettings, meetings: updatedMeetings });
  };

  const toggleActivityMandatory = (areaId: string, subIdx: number, actId: string) => {
    onUpdateStezka(stezkaAreas.map(area => {
      if (area.id !== areaId) return area;
      const newSubs = [...area.subcategories];
      const newActs = newSubs[subIdx].activities.map(act => 
        act.id === actId ? { ...act, isMandatory: !act.isMandatory } : act
      );
      newSubs[subIdx] = { ...newSubs[subIdx], activities: newActs };
      return { ...area, subcategories: newSubs };
    }));
  };

  const updateSubcategoryGoal = (areaId: string, subIdx: number, newGoal: number) => {
    onUpdateStezka(stezkaAreas.map(area => {
      if (area.id !== areaId) return area;
      const newSubs = [...area.subcategories];
      newSubs[subIdx] = { ...newSubs[subIdx], requiredOptionalCount: newGoal };
      return { ...area, subcategories: newSubs };
    }));
  };

  const saveActivityEdit = () => {
    if (!editingActivity) return;
    const { areaId, subIdx, activity } = editingActivity;
    onUpdateStezka(stezkaAreas.map(area => {
      if (area.id !== areaId) return area;
      const newSubs = [...area.subcategories];
      const newActs = newSubs[subIdx].activities.map(act => 
        act.id === activity.id ? activity : act
      );
      newSubs[subIdx] = { ...newSubs[subIdx], activities: newActs };
      return { ...area, subcategories: newSubs };
    }));
    setEditingActivity(null);
  };

  const saveSubcategoryEdit = () => {
    if (!editingSubcategory) return;
    const { areaId, subIdx, title } = editingSubcategory;
    onUpdateStezka(stezkaAreas.map(area => {
      if (area.id !== areaId) return area;
      const newSubs = [...area.subcategories];
      newSubs[subIdx] = { ...newSubs[subIdx], title };
      return { ...area, subcategories: newSubs };
    }));
    setEditingSubcategory(null);
  };

  const saveAreaEdit = () => {
    if (!editingArea) return;
    onUpdateStezka(stezkaAreas.map(area => {
      if (area.id !== editingArea.id) return area;
      return { ...area, title: editingArea.title, icon: editingArea.icon };
    }));
    setEditingArea(null);
  };

  const addNewArea = () => {
    const newArea: Area = {
      id: `area_${Date.now()}`,
      title: 'Nová oblast',
      icon: '🌲',
      subcategories: []
    };
    onUpdateStezka([...stezkaAreas, newArea]);
  };

  const deleteArea = (areaId: string) => {
    onUpdateStezka(stezkaAreas.filter(a => a.id !== areaId));
  };

  const addNewSubcategory = (areaId: string) => {
    onUpdateStezka(stezkaAreas.map(area => {
      if (area.id !== areaId) return area;
      const newSub: Subcategory = {
        title: 'Nová kapitola',
        requiredOptionalCount: 1,
        activities: []
      };
      return { ...area, subcategories: [...area.subcategories, newSub] };
    }));
  };

  const deleteSubcategory = (areaId: string, subIdx: number) => {
    onUpdateStezka(stezkaAreas.map(area => {
      if (area.id !== areaId) return area;
      const newSubs = area.subcategories.filter((_, idx) => idx !== subIdx);
      return { ...area, subcategories: newSubs };
    }));
  };

  const addNewActivity = (areaId: string, subIdx: number) => {
    onUpdateStezka(stezkaAreas.map(area => {
      if (area.id !== areaId) return area;
      const newSubs = [...area.subcategories];
      const newActivity: Activity = {
        id: `custom_${activeLevelId}_${Date.now()}`,
        title: 'Nový úkol',
        description: 'Popis nového úkolu...',
        isMandatory: false,
        pointsValue: 5
      };
      newSubs[subIdx] = { 
        ...newSubs[subIdx], 
        activities: [...newSubs[subIdx].activities, newActivity] 
      };
      return { ...area, subcategories: newSubs };
    }));
  };

  const deleteActivity = (areaId: string, subIdx: number, activityId: string) => {
    onUpdateStezka(stezkaAreas.map(area => {
      if (area.id !== areaId) return area;
      const newSubs = [...area.subcategories];
      newSubs[subIdx] = { 
        ...newSubs[subIdx], 
        activities: newSubs[subIdx].activities.filter(a => a.id !== activityId) 
      };
      return { ...area, subcategories: newSubs };
    }));
  };

  const deleteArticle = (meetingId: string, articleId: string) => {
    const updatedMeetings = safeSettings.meetings.map(m => {
      if (m.id === meetingId) {
        return {
          ...m,
          articles: (m.articles || []).filter(a => a.id !== articleId)
        };
      }
      return m;
    });
    onUpdateSettings({ ...safeSettings, meetings: updatedMeetings });
  };

  const saveGame = () => {
    if (!gameModal || !gameForm.name) return;
    
    const results: GameResult[] = Object.entries(gameForm.results).map(([id, pts]) => ({
      scoutId: gameForm.type === 'individual' ? id : 'team-result',
      teamId: gameForm.type === 'team' ? id : undefined,
      pointsGained: pts as number
    }));

    if (gameModal.game) {
      onUpdateGames(games.map(g => g.id === gameModal.game!.id ? { ...g, name: gameForm.name, results, gameType: gameForm.type, teams: gameForm.teams } : g));
    } else {
      const newGame: Game = { id: Date.now().toString(), name: gameForm.name, meetingId: gameModal.meetingId, gameType: gameForm.type, teams: gameForm.teams, results, levelId: activeLevelId };
      onUpdateGames([...games, newGame]);
    }

    if (gameForm.type === 'individual') {
      onUpdateScouts(scouts.map(s => {
        const oldPts = gameModal.game?.results.find(r => r.scoutId === s.id)?.pointsGained || 0;
        const newPts = gameForm.results[s.id] || 0;
        const currentPoints = s.pointsByLevel[activeLevelId] || 0;
        return { ...s, pointsByLevel: { ...s.pointsByLevel, [activeLevelId]: Math.max(0, currentPoints - oldPts + newPts) } };
      }));
    } else if (gameForm.type === 'team') {
      const meeting = safeSettings.meetings.find(m => m.id === gameModal.meetingId);
      if (meeting && meeting.teams) {
        onUpdateScouts(scouts.map(s => {
          const team = meeting.teams?.find(t => t.members.includes(s.id));
          if (!team) return s;
          
          const oldTeamPts = gameModal.game?.results.find(r => r.teamId === team.name)?.pointsGained || 0;
          const newTeamPts = gameForm.results[team.name] || 0;
          const currentPoints = s.pointsByLevel[activeLevelId] || 0;
          
          return { ...s, pointsByLevel: { ...s.pointsByLevel, [activeLevelId]: Math.max(0, currentPoints - oldTeamPts + newTeamPts) } };
        }));
      }
    }
    setGameModal(null);
  };

  const saveBonus = () => {
    if (!bonusModal || !bonusForm.scoutId) return;
    const newBonus: Bonus = {
      id: Date.now().toString(),
      scoutId: bonusForm.scoutId,
      points: bonusForm.points,
      reason: bonusForm.reason || 'Bonusová odměna',
      date: new Date().toISOString(),
      meetingId: bonusModal.meetingId,
      levelId: activeLevelId
    };
    
    onUpdateSettings({ ...safeSettings, bonuses: [...(safeSettings.bonuses || []), newBonus] });
    onUpdateScouts(scouts.map(s => {
      if (s.id === bonusForm.scoutId) {
        const currentPoints = s.pointsByLevel[activeLevelId] || 0;
        return { ...s, pointsByLevel: { ...s.pointsByLevel, [activeLevelId]: currentPoints + bonusForm.points } };
      }
      return s;
    }));
    setBonusModal(null);
    setBonusForm({ scoutId: '', points: 5, reason: '' });
  };

  const updateAttendance = (meetingId: string, scoutId: string, status: AttendanceStatus) => {
    const meeting = safeSettings.meetings.find(m => m.id === meetingId);
    if (!meeting) return;
    const prevStatus = meeting.attendance?.[scoutId] || 'absent';
    if (prevStatus === status) return;

    const getPoints = (s: AttendanceStatus) => {
      if (s === 'present') return safeSettings.scoring.attendancePresent;
      if (s === 'late') return safeSettings.scoring.attendanceLate;
      if (s === 'excused') return safeSettings.scoring.attendanceExcused;
      return 0;
    };

    const diff = getPoints(status) - getPoints(prevStatus);
    onUpdateScouts(scouts.map(s => {
      if (s.id === scoutId) {
        const currentPoints = s.pointsByLevel[activeLevelId] || 0;
        return { ...s, pointsByLevel: { ...s.pointsByLevel, [activeLevelId]: Math.max(0, currentPoints + diff) } };
      }
      return s;
    }));
    
    const updatedMeetings = safeSettings.meetings.map(m => m.id === meetingId ? {
      ...m, attendance: { ...(m.attendance || {}), [scoutId]: status }
    } : m);
    onUpdateSettings({ ...safeSettings, meetings: updatedMeetings });
  };

  const confirmDeleteAction = () => {
    if (!deleteConfig) return;
    const { type, id, extra } = deleteConfig;
    
    // Pojistka: Vedoucí nemůže mazat adminy
    if (type === 'scout' && userRole === 'leader') {
      const target = scouts.find(s => s.id === id);
      if (target?.role === 'admin') {
        alert("Vedoucí nemůže smazat administrátora.");
        setDeleteConfig(null);
        return;
      }
    }

    if (type === 'scout') onUpdateScouts(scouts.filter(s => s.id !== id));
    if (type === 'meeting') onUpdateSettings({ ...safeSettings, meetings: safeSettings.meetings.filter(m => m.id !== id) });
    if (type === 'game') onUpdateGames(games.filter(g => g.id !== id));
    if (type === 'activity' && extra) deleteActivity(extra.areaId, extra.subIdx, id);
    if (type === 'subcategory' && extra) deleteSubcategory(extra.areaId, id as any);
    if (type === 'area') deleteArea(id);
    if (type === 'article' && extra) deleteArticle(extra.meetingId, id);
    setDeleteConfig(null);
  };

  const resetScoutPassword = (scoutId: string) => {
    if (confirm("Opravdu chcete resetovat heslo tomuto členovi na '1234'?")) {
      onUpdateScouts(scouts.map(s => s.id === scoutId ? { ...s, password: '1234', mustChangePassword: true } : s));
      alert("Heslo bylo resetováno na '1234'. Člen bude vyzván k jeho změně při příštím přihlášení.");
      if (editingScout) setEditingScout({ ...editingScout, password: '1234', mustChangePassword: true });
    }
  };

  const createTeamsFromParticipants = (count: number) => {
    const meeting = safeSettings.meetings.find(m => m.id === gameModal?.meetingId);
    if (!meeting) return;
    
    const presentScouts = scouts.filter(s => meeting.attendance?.[s.id] === 'present' || meeting.attendance?.[s.id] === 'late');
    if (presentScouts.length === 0) {
      alert("Nikdo není přítomen! Označ docházku v detailu akce.");
      return;
    }

    const shuffled = [...presentScouts].sort(() => Math.random() - 0.5);
    const meetingTeams: MeetingTeam[] = Array.from({ length: count }, (_, i) => ({
      name: `Tým ${i + 1}`,
      members: []
    }));

    shuffled.forEach((s, idx) => {
      meetingTeams[idx % count].members.push(s.id);
    });

    const updatedMeetings = safeSettings.meetings.map(m => m.id === meeting.id ? { ...m, teams: meetingTeams } : m);
    onUpdateSettings({ ...safeSettings, meetings: updatedMeetings });

    const gameTeams: GameTeam[] = meetingTeams.map(t => ({ id: t.name, name: t.name }));
    const results: Record<string, number> = {};
    gameTeams.forEach(t => results[t.id] = 0);
    
    setGameForm({ ...gameForm, teams: gameTeams, results });
  };

  const handleSaveScoutProfile = () => {
    if (!editingScout) return;

    const trimmedNickname = editingScout.nickname.trim();
    if (!trimmedNickname) {
      alert("Přezdívka nesmí být prázdná.");
      return;
    }

    const isDuplicate = scouts.some(s => 
      s.id !== editingScout.id && 
      s.nickname.toLowerCase() === trimmedNickname.toLowerCase()
    );

    if (isDuplicate) {
      alert(`Přezdívka "${trimmedNickname}" již existuje. Vyber prosím jinou.`);
      return;
    }

    // Pouze admin může nastavit roli admin
    if (userRole === 'leader' && editingScout.role === 'admin') {
      const original = scouts.find(s => s.id === editingScout.id);
      if (original?.role !== 'admin') {
        alert("Vedoucí nemůže povýšit člena na administrátora.");
        return;
      }
    }

    onUpdateScouts(scouts.map(s => s.id === editingScout.id ? { ...editingScout, nickname: trimmedNickname } : s));
    setEditingScout(null);
  };

  return (
    <div className="p-6 space-y-8 pb-32 animate-fadeIn text-black">
      <input type="file" ref={fileInputRef} onChange={importAllData} accept=".json" className="hidden" />
      
      <header className="space-y-4">
        <h2 className="text-3xl font-bold parchment-font text-[#3b5a3b]">Administrace</h2>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
           {[ 
             {id: 'qr', label: '✍️ Podpis'}, 
             {id: 'users', label: '👥 Členové'}, 
             {id: 'meetings', label: '📅 Akce'}, 
             {id: 'tasks', label: '🧭 Úkoly'}, 
             {id: 'chronicle', label: '📖 Kronika'},
             {id: 'content', label: '🛠️ Obsah'} 
           ].map(tab => (
             <button key={tab.id} onClick={() => setActiveAdminTab(tab.id as any)} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shrink-0 ${activeAdminTab === tab.id ? 'bg-[#3b5a3b] text-white shadow-lg' : 'bg-white text-gray-400 border border-gray-100'}`}>{tab.label}</button>
           ))}
        </div>
      </header>

      {/* 🧭 ÚKOLY TAB */}
      {activeAdminTab === 'tasks' && (
        <div className="space-y-4 animate-fadeIn">
          {stezkaAreas.map(area => {
            const isExpanded = expandedTaskAreaId === area.id;
            return (
              <div key={area.id} className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
                <div className="w-full flex items-center justify-between hover:bg-gray-50/50 transition-colors">
                  <button onClick={() => setExpandedTaskAreaId(isExpanded ? null : area.id)} className="flex-1 p-6 flex items-center gap-4 text-left">
                    <span className="text-3xl">{area.icon}</span>
                    <div className="text-left">
                      <h4 className="text-sm font-black text-gray-800 uppercase tracking-widest">{area.title}</h4>
                      <p className="text-[9px] text-gray-400 font-bold uppercase">{area.subcategories.length} kapitol</p>
                    </div>
                  </button>
                  <div className="flex gap-2 pr-6">
                    <button onClick={() => setEditingArea({ id: area.id, title: area.title, icon: area.icon })} className="p-2 bg-gray-50 rounded-lg border border-gray-100 text-[#3b5a3b]">✏️</button>
                    <button onClick={() => setDeleteConfig({ type: 'area', id: area.id, title: 'Smazat oblast?', message: `Opravdu smazat celou oblast "${area.title}" i se všemi úkoly?` })} className="p-2 bg-red-50 rounded-lg border border-red-100 text-red-500">🗑️</button>
                    <button onClick={() => setExpandedTaskAreaId(isExpanded ? null : area.id)} className={`p-2 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▼</button>
                  </div>
                </div>
                
                {isExpanded && (
                  <div className="px-6 pb-6 space-y-6 bg-gray-50/30 border-t border-gray-50 animate-fadeIn">
                    {area.subcategories.map((sub, sIdx) => (
                      <div key={sIdx} className="space-y-3 pt-4">
                        <div className="flex items-center justify-between border-b pb-1">
                          <div className="flex items-center gap-2">
                             <h5 className="text-[10px] font-black text-[#3b5a3b] uppercase tracking-[0.1em]">{sub.title}</h5>
                             <button onClick={() => setEditingSubcategory({ areaId: area.id, subIdx: sIdx, title: sub.title })} className="text-[8px] opacity-30 hover:opacity-100 transition-opacity">✏️</button>
                             <button onClick={() => setDeleteConfig({ type: 'subcategory', id: sIdx.toString(), title: 'Smazat kapitolu?', message: `Opravdu smazat kapitolu "${sub.title}"?`, extra: { areaId: area.id } })} className="text-[8px] opacity-30 hover:opacity-100 text-red-500 transition-opacity">🗑️</button>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[8px] text-gray-400 font-bold uppercase">Cíl:</span>
                            <input 
                              type="number" 
                              min="0"
                              className="w-12 p-1 bg-white border border-gray-200 rounded-lg text-center font-bold text-[10px] text-[#3b5a3b] outline-none focus:ring-1 ring-[#3b5a3b]" 
                              value={sub.requiredOptionalCount} 
                              onChange={e => updateSubcategoryGoal(area.id, sIdx, parseInt(e.target.value) || 0)} 
                            />
                          </div>
                        </div>
                        <div className="grid gap-2">
                          {sub.activities.map(act => (
                            <div key={act.id} className="flex items-center justify-between bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
                              <div className="flex-1">
                                <p className="text-xs font-bold text-gray-700">{act.title}</p>
                                <p className="text-[8px] text-gray-400">{act.isMandatory ? 'Povinný' : 'Volitelný'} • {act.pointsValue || (act.isMandatory ? safeSettings.scoring.mandatoryTask : safeSettings.scoring.optionalTask)} bodů</p>
                              </div>
                              <div className="flex gap-2">
                                <button onClick={() => toggleActivityMandatory(area.id, sIdx, act.id)} className={`px-2 py-1 rounded-lg text-[8px] font-black border transition-all ${act.isMandatory ? 'bg-[#3b5a3b] text-white border-[#3b5a3b]' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>{act.isMandatory ? 'POV' : 'VOL'}</button>
                                <button onClick={() => setEditingActivity({areaId: area.id, subIdx: sIdx, activity: {...act}})} className="p-2 bg-gray-50 text-[#3b5a3b] rounded-lg border border-gray-200">✏️</button>
                                <button onClick={() => setDeleteConfig({ type: 'activity', id: act.id, title: 'Smazat úkol?', message: `Opravdu smazat úkol "${act.title}"?`, extra: { areaId: area.id, subIdx: sIdx } })} className="p-2 bg-red-50 text-red-500 rounded-lg border border-red-100">🗑️</button>
                              </div>
                            </div>
                          ))}
                          <button 
                            onClick={() => addNewActivity(area.id, sIdx)}
                            className="w-full py-3 mt-2 bg-white border-2 border-dashed border-gray-200 text-gray-400 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:border-[#3b5a3b]/30 hover:text-[#3b5a3b] transition-all"
                          >
                            + Přidat nový úkol
                          </button>
                        </div>
                      </div>
                    ))}
                    <button 
                       onClick={() => addNewSubcategory(area.id)}
                       className="w-full py-4 mt-6 bg-[#3b5a3b]/5 border-2 border-dashed border-[#3b5a3b]/20 text-[#3b5a3b] rounded-[2rem] text-[10px] font-black uppercase tracking-widest hover:bg-[#3b5a3b]/10 transition-all"
                    >
                       + Přidat kapitolu
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          <button 
             onClick={addNewArea}
             className="w-full py-5 mt-4 bg-white border-2 border-dashed border-gray-300 text-gray-400 rounded-[2.5rem] text-xs font-black uppercase tracking-widest hover:border-[#3b5a3b]/30 hover:text-[#3b5a3b] transition-all flex items-center justify-center gap-3"
          >
             <span>✨</span> Přidat novou oblast
          </button>
        </div>
      )}

      {/* 📖 KRONIKA TAB */}
      {activeAdminTab === 'chronicle' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="bg-[#3b5a3b] text-white rounded-[3rem] p-8 shadow-xl relative overflow-hidden">
             <div className="absolute top-0 right-0 p-10 opacity-10 pointer-events-none text-9xl">📖</div>
             <h3 className="text-xl font-bold parchment-font relative z-10">Správa kroniky</h3>
             <p className="text-[10px] opacity-60 uppercase tracking-widest mt-1 relative z-10">Všechny uživatelské zápisy z akcí</p>
             <div className="mt-6 flex items-baseline gap-2 relative z-10">
                <span className="text-4xl font-black">{allArticles.length}</span>
                <span className="text-[10px] font-black uppercase opacity-60">celkem zápisů</span>
             </div>
          </div>

          <div className="grid gap-4">
            {allArticles.length === 0 ? (
              <div className="bg-white rounded-[2.5rem] p-12 border border-dashed border-gray-200 text-center space-y-4">
                <div className="text-5xl opacity-20">✍️</div>
                <p className="text-xs font-bold text-gray-400 uppercase">Zatím nikdo nic nenapsal</p>
              </div>
            ) : (
              allArticles.map(({ article, meeting }) => (
                <div key={article.id} className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-[10px] font-black text-[#3b5a3b] uppercase tracking-widest">{article.scoutNickname}</h4>
                      <p className="text-[8px] text-gray-400 font-bold uppercase">{new Date(article.timestamp).toLocaleString('cs-CZ')}</p>
                    </div>
                    <div className="text-right">
                       <p className="text-[8px] font-black text-gray-300 uppercase leading-none">Ke dni:</p>
                       <p className="text-[10px] font-bold text-gray-600">{new Date(meeting.date).toLocaleDateString('cs-CZ')}</p>
                    </div>
                  </div>
                  <div className="bg-gray-50/50 p-4 rounded-2xl border border-gray-50 italic text-sm text-gray-700 line-clamp-3">
                    {article.content}
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-[8px] font-black text-gray-300 uppercase tracking-widest truncate flex-1">Akce: {meeting.notes || 'Beze jména'}</span>
                    <button 
                      onClick={() => setDeleteConfig({ type: 'article', id: article.id, title: 'Smazat zápis?', message: `Opravdu smazat zápis od ${article.scoutNickname}?`, extra: { meetingId: meeting.id } })}
                      className="px-4 py-2 bg-red-50 text-red-500 rounded-xl text-[9px] font-black uppercase tracking-widest border border-red-100 active:scale-95 transition-all"
                    >
                      Smazat
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 📅 AKCE TAB */}
      {activeAdminTab === 'meetings' && (
        <div className="space-y-6">
          <button onClick={() => onUpdateSettings({...safeSettings, meetings: [{id: Date.now().toString(), date: new Date().toISOString(), notes: 'Nová schůzka', attendance: {}, photos: [], teams: [], albumUrl: DEFAULT_ALBUM_URL}, ...safeSettings.meetings]})} className="w-full py-4 bg-[#3b5a3b] text-white rounded-2xl font-black uppercase text-xs shadow-xl">+ Nová akce</button>
          <div className="grid gap-4">
            {safeSettings.meetings.map(meeting => (
              <div key={meeting.id} className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
                <div className="w-full p-6 flex items-center justify-between">
                  <div className="flex-1 text-left">
                    <span className="text-[10px] font-black text-[#3b5a3b] uppercase">{new Date(meeting.date).toLocaleDateString('cs-CZ')}</span>
                    <p className="text-xs font-bold text-gray-700 truncate">{meeting.notes || 'Bez popisu'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setEditingMeeting(meeting)} className="p-2 bg-gray-50 rounded-lg">✏️</button>
                    <button onClick={() => setDeleteConfig({type: 'meeting', id: meeting.id, title: 'Smazat akci?', message: 'Všechna data z akce zmizí.'})} className="p-2 bg-red-50 text-red-300 rounded-lg">🗑️</button>
                    <button onClick={() => setExpandedMeetingId(expandedMeetingId === meeting.id ? null : meeting.id)} className="p-2">{expandedMeetingId === meeting.id ? '▲' : '▼'}</button>
                  </div>
                </div>
                {expandedMeetingId === meeting.id && (
                  <div className="p-6 pt-0 space-y-6 bg-gray-50/30 border-t border-gray-50 animate-fadeIn">
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-4">
                      <button onClick={() => setGameModal({ meetingId: meeting.id })} className="py-3 bg-white border border-[#3b5a3b]/20 text-[#3b5a3b] rounded-xl text-[8px] font-black uppercase">➕ Hra</button>
                      <button onClick={() => setBulkTaskModal({ meetingId: meeting.id })} className="py-3 bg-[#3b5a3b] text-white rounded-xl text-[8px] font-black uppercase">🤝 Úkol</button>
                      <button onClick={() => setTeamRandomizeModal({ meetingId: meeting.id })} className="py-3 bg-blue-500 text-white rounded-xl text-[8px] font-black uppercase">🎲 Týmy</button>
                      <button onClick={() => setBonusModal({ meetingId: meeting.id })} className="py-3 bg-amber-500 text-white rounded-xl text-[8px] font-black uppercase">💎 Odměna</button>
                    </div>

                    <div className="space-y-2">
                       <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Docházka</h4>
                       <div className="grid gap-2">
                         {scouts.map(scout => (
                           <div key={scout.id} className="flex items-center justify-between bg-white p-3 rounded-2xl border">
                              <span className="text-xs font-bold">{scout.avatar} {scout.nickname}</span>
                              <div className="flex gap-1">
                                {['present', 'late', 'excused', 'absent'].map(s => (
                                  <button key={s} onClick={() => updateAttendance(meeting.id, scout.id, s as AttendanceStatus)} className={`w-8 h-8 rounded-lg text-xs flex items-center justify-center border ${meeting.attendance?.[scout.id] === s ? 'bg-[#3b5a3b] border-[#3b5a3b]' : 'bg-gray-50 text-gray-300'}`}>
                                    {s === 'present' ? '✅' : s === 'late' ? '⏰' : s === 'excused' ? '📝' : '❌'}
                                  </button>
                                ))}
                              </div>
                           </div>
                         ))}
                       </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 👥 ČLENOVÉ TAB */}
      {activeAdminTab === 'users' && (
        <div className="space-y-6">
          <button onClick={() => {
            const nickname = 'Nový skaut';
            const isDuplicate = scouts.some(s => s.nickname.toLowerCase() === nickname.toLowerCase());
            const finalNickname = isDuplicate ? `Nový skaut ${scouts.length + 1}` : nickname;
            onUpdateScouts([{id: Date.now().toString(), name: 'Nový skaut', nickname: finalNickname, avatar: '🌲', role: 'user', pointsByLevel: {}, activitiesProgress: {}, activityCompletionDates: {}, completedActivities: [], password: '1234', mustChangePassword: true}, ...scouts])
          }} className="w-full py-4 bg-[#3b5a3b] text-white rounded-2xl font-black uppercase text-xs shadow-xl">+ Nový člen</button>
          <div className="grid gap-4">
            {scouts.map(s => (
              <div key={s.id} className="bg-white p-5 rounded-[2.5rem] border flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4">
                  <span className="text-3xl">{s.avatar}</span>
                  <div>
                    <div className="flex items-center gap-2">
                       <h4 className="font-bold text-sm text-gray-800">{s.nickname}</h4>
                       {s.role === 'admin' && <span className="text-[6px] bg-red-500 text-white px-1 py-0.5 rounded-md font-black uppercase">ADMIN</span>}
                       {s.role === 'leader' && <span className="text-[6px] bg-blue-500 text-white px-1 py-0.5 rounded-md font-black uppercase">VEDOUCÍ</span>}
                    </div>
                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">{s.pointsByLevel[activeLevelId] || 0} bodů</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setSigningScout(s)} className="p-3 bg-blue-50 text-blue-600 rounded-xl text-[9px] font-black uppercase">🧭 Podpisy</button>
                  <button onClick={() => setEditingScout({...s})} className="p-3 bg-gray-50 text-[#3b5a3b] rounded-xl">✏️</button>
                  <button 
                    onClick={() => setDeleteConfig({type: 'scout', id: s.id, title: 'Smazat skauta?', message: `Opravdu smazat ${s.nickname}?`})} 
                    disabled={userRole === 'leader' && s.role === 'admin'}
                    className={`p-3 rounded-xl transition-all ${userRole === 'leader' && s.role === 'admin' ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-red-50 text-red-500'}`}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 🛠️ OBSAH TAB */}
      {activeAdminTab === 'content' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm space-y-10">
            <section className="space-y-4">
              <h3 className="text-sm font-black text-[#3b5a3b] uppercase tracking-widest">Nastavení leaderboardu</h3>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100/50">
                <div className="flex-1">
                  <span className="text-[10px] font-black text-gray-500 uppercase">Zobrazit celkový leaderboard</span>
                  <p className="text-[8px] text-gray-300 mt-1 uppercase">Pokud je vypnuto, uživatelé vidí jen posledních 30 dní</p>
                </div>
                <button 
                  onClick={() => onUpdateSettings({...safeSettings, showTotalLeaderboard: !safeSettings.showTotalLeaderboard})}
                  className={`w-12 h-6 rounded-full relative transition-colors ${safeSettings.showTotalLeaderboard ? 'bg-[#3b5a3b]' : 'bg-gray-200'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${safeSettings.showTotalLeaderboard ? 'right-1' : 'left-1'}`} />
                </button>
              </div>
            </section>

            <section className="space-y-4 pt-6 border-t">
              <h3 className="text-sm font-black text-[#3b5a3b] uppercase tracking-widest">Dokumenty a Odkazy</h3>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase text-gray-400 pl-4">URL odkaz na PDF stezku (např. Disk)</label>
                  <input 
                    type="url" 
                    className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-bold outline-none focus:ring-2 ring-[#3b5a3b]/20" 
                    placeholder="https://drive.google.com/..." 
                    value={safeSettings.pdfUrl || ''} 
                    onChange={e => onUpdateSettings({...safeSettings, pdfUrl: e.target.value})} 
                  />
                  <p className="text-[8px] text-gray-300 px-4 uppercase">Pokud vyplníš, tlačítko ve Stezce otevře tento odkaz.</p>
                </div>
              </div>
            </section>

            <section className="space-y-4 pt-6 border-t">
              <h3 className="text-sm font-black text-[#3b5a3b] uppercase tracking-widest">Nastavení bodování</h3>
              <div className="grid grid-cols-1 gap-3">
                {[
                  {label: 'Povinný úkol', key: 'mandatoryTask'},
                  {label: 'Volitelný úkol', key: 'optionalTask'},
                  {label: 'Účast (přítomen)', key: 'attendancePresent'},
                  {label: 'Účast (pozdě)', key: 'attendanceLate'},
                  {label: 'Omluvenka', key: 'attendanceExcused'},
                ].map(item => (
                  <div key={item.key} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100/50">
                    <span className="text-[10px] font-black text-gray-500 uppercase">{item.label}</span>
                    <input type="number" className="w-16 p-2 bg-white border rounded-xl text-center font-bold" value={safeSettings.scoring[item.key as keyof typeof safeSettings.scoring]} onChange={e => onUpdateSettings({...safeSettings, scoring: {...safeSettings.scoring, [item.key]: parseInt(e.target.value) || 0}})} />
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-4 pt-6 border-t">
              <h3 className="text-sm font-black text-[#3b5a3b] uppercase tracking-widest">Správa dat</h3>
              <div className="grid grid-cols-2 gap-4">
                <button onClick={exportAllData} className="p-5 bg-blue-50 text-blue-600 rounded-2xl font-bold text-xs flex flex-col items-center gap-2"><span>💾</span> Zálohovat</button>
                <button onClick={() => fileInputRef.current?.click()} className="p-5 bg-amber-50 text-amber-600 rounded-2xl font-bold text-xs flex flex-col items-center gap-2"><span>📂</span> Nahrát zálohu</button>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* ✍️ PODPIS TAB */}
      {activeAdminTab === 'qr' && (
        <section className="space-y-6 animate-fadeIn">
          <div className="bg-[#3b5a3b] text-white rounded-[3rem] p-8 shadow-xl relative overflow-hidden">
             <div className="absolute top-0 right-0 p-10 opacity-10 pointer-events-none text-9xl">✍️</div>
             <h3 className="text-xl font-bold parchment-font relative z-10">Čekající podpisy</h3>
             <p className="text-[10px] opacity-60 uppercase tracking-widest mt-1 relative z-10">Zde vidíš úkoly, které skauti označili jako hotové</p>
             <div className="mt-6 flex items-baseline gap-2 relative z-10">
                <span className="text-4xl font-black">{pendingApprovals.length}</span>
                <span className="text-[10px] font-black uppercase opacity-60">úkolů ve frontě</span>
             </div>
          </div>

          <div className="grid gap-3">
             {pendingApprovals.length === 0 ? (
               <div className="bg-white rounded-[2.5rem] p-12 border border-dashed border-gray-200 text-center space-y-4">
                  <div className="text-5xl opacity-20">🍃</div>
                  <p className="text-xs font-bold text-gray-400 uppercase">Všechny podpisy jsou vyřízeny</p>
               </div>
             ) : (
               pendingApprovals.map((approval, idx) => {
                 const pts = approval.activity.pointsValue || (approval.activity.isMandatory ? safeSettings.scoring.mandatoryTask : safeSettings.scoring.optionalTask);
                 return (
                   <div key={`${approval.scout.id}-${approval.activity.id}`} className="bg-white p-5 rounded-[2rem] border border-gray-100 shadow-sm flex items-center justify-between animate-fadeIn" style={{ animationDelay: `${idx * 0.05}s` }}>
                      <div className="flex items-center gap-4 flex-1">
                         <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-2xl border border-gray-100 shadow-inner">
                            {approval.scout.avatar}
                         </div>
                         <div className="flex-1 min-w-0">
                            <h4 className="text-xs font-black text-gray-800 uppercase tracking-tight truncate">{approval.scout.nickname}</h4>
                            <div className="flex items-center gap-2 mt-1">
                               <span className="text-[9px] text-[#3b5a3b] font-bold">{approval.area.icon} {approval.activity.title}</span>
                               <span className="text-[8px] px-1.5 py-0.5 bg-gray-50 text-gray-400 rounded-md font-black">+{pts} b.</span>
                            </div>
                         </div>
                      </div>
                      <button 
                        onClick={() => toggleScoutTaskSignature(approval.scout.id, approval.activity.id)}
                        className="ml-4 px-6 py-3 bg-[#3b5a3b] text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg hover:shadow-xl active:scale-95 transition-all"
                      >
                        Podepsat
                      </button>
                   </div>
                 );
               })
             )}
          </div>

          <div className="pt-10 flex flex-col items-center space-y-4 opacity-30 hover:opacity-100 transition-opacity">
             <p className="text-[8px] font-black text-gray-400 uppercase">Rychlé digitální razítko</p>
             <div className="bg-white p-4 rounded-3xl inline-block border-4 border-white shadow-sm">
                <QRCodeSVG value={qrCodeValue || 'PENDING'} size={80} />
             </div>
             <p className="text-[8px] font-bold text-gray-300">Platnost: {qrTimeout}s</p>
          </div>
        </section>
      )}

      {/* --- MODALS --- */}
      
      {/* Edit Subcategory Modal */}
      {editingSubcategory && (
        <div className="fixed inset-0 z-[600] bg-black/60 backdrop-blur-xl flex items-center justify-center p-6">
          <div className="bg-white rounded-[3rem] p-8 max-sm w-full space-y-6 shadow-2xl animate-fadeIn">
            <h3 className="text-xl font-bold text-[#3b5a3b] text-center">Přejmenovat kapitolu</h3>
            <input className="w-full p-4 bg-gray-50 border rounded-2xl text-sm font-bold" value={editingSubcategory.title} onChange={e => setEditingSubcategory({...editingSubcategory, title: e.target.value})} placeholder="Název kapitoly" />
            <button onClick={saveSubcategoryEdit} className="w-full py-4 bg-[#3b5a3b] text-white rounded-2xl font-bold shadow-xl">Uložit</button>
            <button onClick={() => setEditingSubcategory(null)} className="w-full text-gray-400 text-[10px] font-black uppercase">Zrušit</button>
          </div>
        </div>
      )}

      {/* Edit Area Modal */}
      {editingArea && (
        <div className="fixed inset-0 z-[600] bg-black/60 backdrop-blur-xl flex items-center justify-center p-6">
          <div className="bg-white rounded-[3rem] p-8 max-sm w-full space-y-6 shadow-2xl animate-fadeIn">
            <h3 className="text-xl font-bold text-[#3b5a3b] text-center">Upravit oblast</h3>
            <div className="space-y-4">
               <div className="flex gap-4">
                  <div className="w-20 space-y-1">
                     <label className="text-[9px] font-black uppercase text-gray-400 pl-2">Ikona</label>
                     <input className="w-full p-4 bg-gray-50 border rounded-2xl text-xl text-center" value={editingArea.icon} onChange={e => setEditingArea({...editingArea, icon: e.target.value})} />
                  </div>
                  <div className="flex-1 space-y-1">
                     <label className="text-[9px] font-black uppercase text-gray-400 pl-2">Název oblasti</label>
                     <input className="w-full p-4 bg-gray-50 border rounded-2xl text-sm font-bold" value={editingArea.title} onChange={e => setEditingArea({...editingArea, title: e.target.value})} placeholder="Název oblasti" />
                  </div>
               </div>
            </div>
            <button onClick={saveAreaEdit} className="w-full py-4 bg-[#3b5a3b] text-white rounded-2xl font-bold shadow-xl">Uložit</button>
            <button onClick={() => setEditingArea(null)} className="w-full text-gray-400 text-[10px] font-black uppercase">Zrušit</button>
          </div>
        </div>
      )}

      {/* Signing Scout Modal */}
      {signingScout && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-6 bg-[#3b5a3b]/60 backdrop-blur-xl">
          <div className="bg-white rounded-[3rem] p-8 max-md w-full max-h-[90vh] flex flex-col space-y-6 shadow-2xl animate-fadeIn">
            <div className="text-center">
              <h3 className="text-xl font-bold text-[#3b5a3b]">{signingScout.nickname} - Podpisy</h3>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Ruční schválení úkolů</p>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-4 pr-2 scrollbar-hide">
              {stezkaAreas.map(area => (
                <div key={area.id} className="border border-gray-100 rounded-3xl overflow-hidden bg-gray-50/30">
                  <button onClick={() => setExpandedSignAreaId(expandedSignAreaId === area.id ? null : area.id)} className="w-full p-4 flex items-center justify-between hover:bg-white transition-colors">
                     <div className="flex items-center gap-3">
                        <span className="text-2xl">{area.icon}</span>
                        <span className="text-xs font-black uppercase tracking-widest text-gray-700">{area.title}</span>
                     </div>
                     <span className={`text-[#3b5a3b] text-[10px] transition-transform ${expandedSignAreaId === area.id ? 'rotate-180' : ''}`}>▼</span>
                  </button>
                  
                  {expandedSignAreaId === area.id && (
                    <div className="p-3 space-y-4 bg-white border-t border-gray-50 animate-fadeIn">
                      {area.subcategories.map((sub, sIdx) => (
                        <div key={sIdx} className="space-y-2">
                          <h4 className="text-[8px] font-black text-[#3b5a3b] uppercase tracking-widest pl-2 mb-1">{sub.title}</h4>
                          <div className="grid gap-2">
                            {sub.activities.map(act => {
                              const isSigned = signingScout.activitiesProgress[act.id] === 'signed';
                              const pts = act.pointsValue || (act.isMandatory ? safeSettings.scoring.mandatoryTask : safeSettings.scoring.optionalTask);
                              return (
                                <button 
                                  key={act.id} 
                                  onClick={() => toggleScoutTaskSignature(signingScout.id, act.id)}
                                  className={`flex items-center justify-between p-3 rounded-2xl border transition-all text-left ${isSigned ? 'bg-[#3b5a3b] border-[#3b5a3b] text-white' : 'bg-white border-gray-100 hover:border-[#3b5a3b]/30'}`}
                                >
                                  <div className="flex-1">
                                    <p className="text-[10px] font-bold leading-tight">{act.title}</p>
                                    <p className={`text-[7px] font-black uppercase mt-0.5 ${isSigned ? 'text-white/60' : 'text-gray-300'}`}>
                                      {act.isMandatory ? 'Povinný' : 'Volitelný'} • {pts} bodů
                                    </p>
                                  </div>
                                  <span className="text-lg ml-2">{isSigned ? '✅' : '⚪️'}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            <button onClick={() => setSigningScout(null)} className="w-full py-4 bg-[#3b5a3b] text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl">Hotovo</button>
          </div>
        </div>
      )}

      {/* Bonus Modal */}
      {bonusModal && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-6 bg-[#3b5a3b]/60 backdrop-blur-xl">
          <div className="bg-white rounded-[3rem] p-8 max-sm w-full space-y-6 shadow-2xl animate-fadeIn">
            <h3 className="text-xl font-bold parchment-font text-[#3b5a3b] text-center">Odměnit skauta 💎</h3>
            <div className="space-y-4">
              <select className="w-full p-4 bg-gray-50 border rounded-2xl text-xs font-bold" value={bonusForm.scoutId} onChange={e => setBonusForm({...bonusForm, scoutId: e.target.value})}>
                <option value="">-- Vyber skauta --</option>
                {scouts.map(s => (
                  <option key={s.id} value={s.id}>{s.avatar} {s.nickname}</option>
                ))}
              </select>
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                 <span className="text-[10px] font-black uppercase text-gray-500">Počet bodů:</span>
                 <input type="number" className="w-16 p-2 bg-white border rounded-xl text-center font-bold" value={bonusForm.points} onChange={e => setBonusForm({...bonusForm, points: parseInt(e.target.value) || 0})} />
              </div>
              <input className="w-full p-4 bg-gray-50 border rounded-2xl text-sm" placeholder="Důvod..." value={bonusForm.reason} onChange={e => setBonusForm({...bonusForm, reason: e.target.value})} />
            </div>
            <button onClick={saveBonus} disabled={!bonusForm.scoutId} className="w-full py-4 bg-[#3b5a3b] text-white rounded-2xl font-bold shadow-xl disabled:opacity-50">Odměnit</button>
            <button onClick={() => setBonusModal(null)} className="w-full text-gray-400 text-[10px] font-black uppercase">Zrušit</button>
          </div>
        </div>
      )}

      {/* Game Modal */}
      {gameModal && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-6 bg-[#3b5a3b]/60 backdrop-blur-xl">
          <div className="bg-white rounded-[3rem] p-8 max-md w-full max-h-[90vh] flex flex-col space-y-6 shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold parchment-font text-[#3b5a3b]">{gameModal.game ? 'Upravit hru' : 'Nová hra'}</h3>
              <div className="flex gap-2">
                {gameForm.type === 'team' && (
                  <button onClick={() => {
                    const meeting = safeSettings.meetings.find(m => m.id === gameModal.meetingId);
                    if (meeting && meeting.teams) {
                      const newTeams = meeting.teams.map(t => ({ id: t.name, name: t.name }));
                      const newResults = { ...gameForm.results };
                      newTeams.forEach(t => { if (!newResults[t.id]) newResults[t.id] = 0; });
                      setGameForm({ ...gameForm, teams: newTeams, results: newResults });
                    } else {
                      alert("Tato akce nemá definované žádné týmy.");
                    }
                  }} className="text-[8px] font-black uppercase text-[#3b5a3b] bg-[#3b5a3b]/5 px-3 py-2 rounded-xl border border-[#3b5a3b]/20">📋 Načíst týmy</button>
                )}
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-6 pr-2 scrollbar-hide">
              <input className="w-full p-4 bg-gray-50 border rounded-2xl font-bold text-sm" placeholder="Název hry" value={gameForm.name} onChange={e => setGameForm({...gameForm, name: e.target.value})} />
              <div className="flex bg-gray-50 p-1 rounded-2xl border">
                <button onClick={() => setGameForm({...gameForm, type: 'individual', teams: []})} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase ${gameForm.type === 'individual' ? 'bg-white shadow-sm text-[#3b5a3b]' : 'text-gray-400'}`}>Individuální</button>
                <button onClick={() => setGameForm({...gameForm, type: 'team'})} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase ${gameForm.type === 'team' ? 'bg-white shadow-sm text-[#3b5a3b]' : 'text-gray-400'}`}>Týmová</button>
              </div>

              <div className="space-y-2">
                {gameForm.type === 'individual' ? (
                  scouts.map(s => (
                    <div key={s.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl">
                      <div className="flex items-center gap-3"><span className="text-lg">{s.avatar}</span><span className="text-xs font-bold">{s.nickname}</span></div>
                      <input type="number" className="w-16 p-2 bg-white border rounded-xl text-center font-bold" value={gameForm.results[s.id] || ''} onChange={e => setGameForm({...gameForm, results: {...gameForm.results, [s.id]: parseInt(e.target.value) || 0}})} />
                    </div>
                  ))
                ) : (
                  <div className="space-y-4">
                    {gameForm.teams.length === 0 ? (
                      <div className="text-center py-8 space-y-4">
                        <p className="text-[10px] text-gray-400 italic font-bold">Zatím nejsou přidány žádné týmy.</p>
                        <div className="grid grid-cols-2 gap-2">
                          {[2, 3, 4].map(num => (
                             <button key={num} onClick={() => createTeamsFromParticipants(num)} className="py-4 bg-[#3b5a3b] text-white rounded-2xl font-black text-[9px] uppercase tracking-widest shadow-lg active:scale-95 transition-all">Vytvořit {num} týmy</button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="grid gap-4">
                        {gameForm.teams.map(t => {
                          const meetingTeams = safeSettings.meetings.find(m => m.id === gameModal.meetingId)?.teams || [];
                          const teamData = meetingTeams.find(mt => mt.name === t.name);
                          
                          return (
                            <div key={t.id} className="bg-gray-50 p-5 rounded-[2.5rem] border border-gray-100 shadow-sm space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-widest text-[#3b5a3b]">{t.name}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] font-bold text-gray-400 uppercase">Body:</span>
                                  <input type="number" className="w-16 p-2 bg-white border rounded-xl text-center font-bold" value={gameForm.results[t.id] || ''} onChange={e => setGameForm({...gameForm, results: {...gameForm.results, [t.id]: parseInt(e.target.value) || 0}})} />
                                </div>
                              </div>
                              
                              <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                                {teamData?.members.map(mid => {
                                  const s = scouts.find(sc => sc.id === mid);
                                  if (!s) return null;
                                  return (
                                    <div key={mid} className="bg-white border border-gray-100 rounded-2xl px-3 py-1.5 flex items-center gap-2 shadow-sm relative group">
                                      <span className="text-sm">{s.avatar}</span>
                                      <span className="text-[9px] font-bold text-gray-600 truncate max-w-[60px]">{s.nickname}</span>
                                      <select 
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                        value={t.name}
                                        onChange={(e) => moveScoutBetweenTeams(gameModal.meetingId, mid, e.target.value)}
                                      >
                                        {gameForm.teams.map(otherT => (
                                          <option key={otherT.id} value={otherT.name}>Přesunout do {otherT.name}</option>
                                        ))}
                                      </select>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                        <button onClick={() => setGameForm({...gameForm, teams: []})} className="w-full py-2 text-[8px] font-bold text-red-400 uppercase">Smazat týmy</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <button onClick={saveGame} disabled={!gameForm.name} className="w-full py-4 bg-[#3b5a3b] text-white rounded-2xl font-bold shadow-xl disabled:opacity-50">Uložit výsledky</button>
            <button onClick={() => setGameModal(null)} className="w-full text-gray-400 text-[10px] font-black uppercase">Zrušit</button>
          </div>
        </div>
      )}

      {/* Bulk Task Modal */}
      {bulkTaskModal && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-6 bg-[#3b5a3b]/60 backdrop-blur-xl">
          <div className="bg-white rounded-[3rem] p-8 max-w-md w-full max-h-[90vh] flex flex-col space-y-6 shadow-2xl">
            <h3 className="text-xl font-bold text-[#3b5a3b]">Hromadný úkol</h3>
            <div className="flex-1 overflow-y-auto space-y-6 pr-2 scrollbar-hide">
              <select className="w-full p-4 bg-gray-50 border rounded-2xl text-xs font-bold" value={bulkTaskForm.taskId} onChange={e => setBulkTaskForm({...bulkTaskForm, taskId: e.target.value})}>
                <option value="">-- Vyber úkol --</option>
                {stezkaAreas.map(a => (
                  <optgroup key={a.id} label={`${a.icon} ${a.title}`}>
                    {a.subcategories.map(s => s.activities.map(act => (
                      <option key={act.id} value={act.id}>{act.title}</option>
                    )))}
                  </optgroup>
                ))}
              </select>
              <div className="grid gap-2">
                {scouts.map(s => (
                  <label key={s.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl cursor-pointer">
                    <span className="text-xs font-bold">{s.avatar} {s.nickname}</span>
                    <input type="checkbox" className="w-5 h-5 accent-[#3b5a3b]" checked={bulkTaskForm.selectedScouts.includes(s.id)} onChange={e => {
                      const newSel = e.target.checked ? [...bulkTaskForm.selectedScouts, s.id] : bulkTaskForm.selectedScouts.filter(id => id !== s.id);
                      setBulkTaskForm({...bulkTaskForm, selectedScouts: newSel});
                    }} />
                  </label>
                ))}
              </div>
            </div>
            <button onClick={() => {
              if(!bulkTaskForm.taskId || bulkTaskForm.selectedScouts.length === 0) return;
              let ptsToAdd = 10;
              stezkaAreas.forEach(a => a.subcategories.forEach(sub => {
                const act = sub.activities.find(x => x.id === bulkTaskForm.taskId);
                if (act) ptsToAdd = act.pointsValue || (act.isMandatory ? safeSettings.scoring.mandatoryTask : safeSettings.scoring.optionalTask);
              }));
              onUpdateScouts(scouts.map(s => {
                if (bulkTaskForm.selectedScouts.includes(s.id) && s.activitiesProgress[bulkTaskForm.taskId] !== 'signed') {
                  const currentPoints = s.pointsByLevel[activeLevelId] || 0;
                  const today = new Date().toISOString();
                  return { ...s, pointsByLevel: { ...s.pointsByLevel, [activeLevelId]: currentPoints + ptsToAdd }, activitiesProgress: { ...s.activitiesProgress, [bulkTaskForm.taskId]: 'signed' }, activityCompletionDates: { ...s.activityCompletionDates, [bulkTaskForm.taskId]: today }};
                }
                return s;
              }));
              setBulkTaskModal(null);
            }} className="w-full py-4 bg-[#3b5a3b] text-white rounded-2xl font-bold">Podepsat všem</button>
            <button onClick={() => setBulkTaskModal(null)} className="w-full text-gray-400 text-[10px] font-black uppercase">Zrušit</button>
          </div>
        </div>
      )}

      {/* Edit Activity Modal */}
      {editingActivity && (
        <div className="fixed inset-0 z-[600] bg-black/60 backdrop-blur-xl flex items-center justify-center p-6">
          <div className="bg-white rounded-[3rem] p-8 max-sm w-full space-y-6 shadow-2xl animate-fadeIn">
            <h3 className="text-xl font-bold text-[#3b5a3b] text-center">Editace úkolu</h3>
            <div className="space-y-4">
              <input className="w-full p-4 bg-gray-50 border rounded-2xl text-sm font-bold" value={editingActivity.activity.title} onChange={e => setEditingActivity({...editingActivity, activity: {...editingActivity.activity, title: e.target.value}})} placeholder="Název úkolu" />
              <textarea className="w-full p-4 bg-gray-50 border rounded-2xl text-sm h-32" value={editingActivity.activity.description} onChange={e => setEditingActivity({...editingActivity, activity: {...editingActivity.activity, description: e.target.value}})} placeholder="Popis úkolu..." />
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                 <span className="text-[10px] font-black uppercase text-gray-500">Body za úkol:</span>
                 <input type="number" className="w-16 p-2 bg-white border rounded-xl text-center font-bold" value={editingActivity.activity.pointsValue || 0} onChange={e => setEditingActivity({...editingActivity, activity: {...editingActivity.activity, pointsValue: parseInt(e.target.value) || 0}})} />
              </div>
            </div>
            <button onClick={saveActivityEdit} className="w-full py-4 bg-[#3b5a3b] text-white rounded-2xl font-bold shadow-xl">Uložit úkol</button>
            <button onClick={() => setEditingActivity(null)} className="w-full text-gray-400 text-[10px] font-black uppercase">Zrušit</button>
          </div>
        </div>
      )}

      {/* Scout Edit Modal */}
      {editingScout && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-6 bg-[#3b5a3b]/60 backdrop-blur-xl">
          <div className="bg-white rounded-[3rem] p-8 max-sm w-full space-y-6 shadow-2xl animate-fadeIn max-h-[90vh] overflow-y-auto scrollbar-hide">
            <h3 className="text-xl font-bold parchment-font text-[#3b5a3b] text-center">Profil skauta</h3>
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-2">
                <span className="text-5xl p-4 bg-gray-50 rounded-3xl">{editingScout.avatar}</span>
                <div className="grid grid-cols-6 gap-2 p-3 bg-gray-50 rounded-2xl max-h-32 overflow-y-auto border border-gray-100 scrollbar-hide">
                  {ALL_AVATARS.map(a => (
                    <button key={a} onClick={() => setEditingScout({...editingScout, avatar: a})} className="text-xl p-1 hover:scale-110">{a}</button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 pl-4">Přezdívka</label>
                  <input className="w-full p-4 bg-gray-50 border rounded-2xl text-sm font-bold" placeholder="Přezdívka" value={editingScout.nickname} onChange={e => setEditingScout({...editingScout, nickname: e.target.value})} />
                </div>
                
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 pl-4">Role</label>
                  <select 
                    className="w-full p-4 bg-gray-50 border rounded-2xl text-sm font-bold"
                    value={editingScout.role}
                    onChange={(e) => setEditingScout({...editingScout, role: e.target.value as UserRole})}
                  >
                    <option value="user">Uživatel (Skaut)</option>
                    <option value="leader">Vedoucí</option>
                    {/* Jen admin může povýšit na admina */}
                    {userRole === 'admin' && <option value="admin">Administrátor</option>}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 pl-4">Celé jméno (Admin pouze)</label>
                  <input className="w-full p-4 bg-gray-50 border rounded-2xl text-sm" placeholder="Např. Jan Novák" value={editingScout.name || ''} onChange={e => setEditingScout({...editingScout, name: e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 pl-4">Celkové body ({activeLevelId})</label>
                  <input type="number" className="w-full p-4 bg-gray-50 border rounded-2xl text-center font-black text-xl text-[#3b5a3b]" value={editingScout.pointsByLevel[activeLevelId] || 0} onChange={e => setEditingScout({...editingScout, pointsByLevel: { ...editingScout.pointsByLevel, [activeLevelId]: parseInt(e.target.value) || 0}})} />
                </div>
                
                <div className="pt-4 space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="flex-1">
                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none">Blokace profilu</p>
                    </div>
                    <button 
                      onClick={() => setEditingScout({...editingScout, isProfileLocked: !editingScout.isProfileLocked})}
                      className={`w-12 h-6 rounded-full relative transition-colors ${editingScout.isProfileLocked ? 'bg-red-500' : 'bg-gray-200'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${editingScout.isProfileLocked ? 'right-1' : 'left-1'}`} />
                    </button>
                  </div>
                  
                  <button 
                    onClick={() => resetScoutPassword(editingScout.id)}
                    className="w-full py-3 bg-red-50 text-red-500 rounded-xl text-[9px] font-black uppercase tracking-widest border border-red-100"
                  >
                    Resetovat heslo na 1234
                  </button>
                </div>
              </div>
            </div>
            <button onClick={handleSaveScoutProfile} className="w-full py-4 bg-[#3b5a3b] text-white rounded-2xl font-bold shadow-xl">Uložit profil</button>
            <button onClick={() => setEditingScout(null)} className="w-full text-gray-400 text-[10px] font-black uppercase text-center">Zrušit</button>
          </div>
        </div>
      )}

      {/* Meeting Edit Modal */}
      {editingMeeting && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-6 bg-[#3b5a3b]/60 backdrop-blur-xl">
          <div className="bg-white rounded-[3rem] p-8 max-sm w-full space-y-6 shadow-2xl">
            <h3 className="text-xl font-bold parchment-font text-[#3b5a3b]">Upravit akci</h3>
            <div className="space-y-4">
              <input type="datetime-local" className="w-full p-4 bg-gray-50 border rounded-2xl font-bold text-sm" value={new Date(new Date(editingMeeting.date).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)} onChange={e => setEditingMeeting({...editingMeeting, date: e.target.value})} />
              <textarea className="w-full p-4 bg-gray-50 border rounded-2xl text-sm" placeholder="Popis akce..." value={editingMeeting.notes} onChange={e => setEditingMeeting({...editingMeeting, notes: e.target.value})} rows={2} />
              <div className="space-y-1">
                 <label className="text-[9px] font-black uppercase text-gray-400 pl-4">Odkaz na fotoalbum</label>
                 <input type="url" className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-bold" placeholder="https://photos.google.com/..." value={editingMeeting.albumUrl || ''} onChange={e => setEditingMeeting({...editingMeeting, albumUrl: e.target.value})} />
              </div>
            </div>
            <button onClick={() => {
              onUpdateSettings({...safeSettings, meetings: safeSettings.meetings.map(m => m.id === editingMeeting.id ? editingMeeting : m)});
              setEditingMeeting(null);
            }} className="w-full py-4 bg-[#3b5a3b] text-white rounded-2xl font-bold shadow-xl">Uložit změny</button>
            <button onClick={() => setEditingMeeting(null)} className="w-full text-gray-400 text-[9px] font-black uppercase">Zrušit</button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfig && (
        <div className="fixed inset-0 z-[700] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-[3rem] p-10 max-sm w-full shadow-2xl text-center">
            <h3 className="text-2xl font-bold parchment-font text-red-500">{deleteConfig.title}</h3>
            <p className="text-sm text-gray-500 mt-2">{deleteConfig.message}</p>
            <div className="flex gap-4 mt-8">
              <button onClick={() => setDeleteConfig(null)} className="flex-1 py-4 bg-gray-100 rounded-2xl font-bold">Zrušit</button>
              <button onClick={confirmDeleteAction} className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-bold">Smazat</button>
            </div>
          </div>
        </div>
      )}

      {/* Team Randomizer Modal */}
      {teamRandomizeModal && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-6 bg-[#3b5a3b]/60 backdrop-blur-xl">
          <div className="bg-white rounded-[3rem] p-8 max-sm w-full space-y-6 shadow-2xl text-center">
            <h3 className="text-xl font-bold text-[#3b5a3b]">Rozlosovat do týmů</h3>
            <div className="grid grid-cols-3 gap-2">
              {[2, 3, 4, 5, 6].map(n => (
                <button key={n} onClick={() => randomizeMeetingTeams(teamRandomizeModal.meetingId, n)} className="py-4 bg-gray-50 border rounded-2xl font-black text-lg hover:bg-[#3b5a3b] hover:text-white transition-all">{n}</button>
              ))}
            </div>
            <button onClick={() => setTeamRandomizeModal(null)} className="w-full text-gray-400 text-[9px] font-black uppercase">Zrušit</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
