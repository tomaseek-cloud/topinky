
import React, { useState, useMemo } from 'react';
// Fix: Added UserRole to imports
import { Scout, Area, ActivityStatus, AppSettings, Subcategory, Activity, TrailLevel, UserRole } from '../types';
import { PDF_BASE64_DATA } from '../pdfData';

declare const Html5QrcodeScanner: any;

interface Props {
  level: TrailLevel;
  scouts: Scout[];
  currentScoutId: string | null;
  // Fix: Changed 'admin' | 'user' | null to UserRole | null
  userRole: UserRole | null;
  settings: AppSettings;
  onUpdateScouts: (scouts: Scout[]) => void;
  onSignActivity: (activityId: string) => void;
  leaderSecret: string;
}

const Stezka: React.FC<Props> = ({ level, scouts, currentScoutId, userRole, settings, onUpdateScouts, onSignActivity, leaderSecret }) => {
  const [selectedArea, setSelectedArea] = useState<Area | null>(null);
  const [expandedSubIdx, setExpandedSubIdx] = useState<number | null>(null);
  const [isScanning, setIsScanning] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ activityId: string; status: ActivityStatus; sub: Subcategory } | null>(null);
  const [justCompletedId, setJustCompletedId] = useState<string | null>(null);
  
  // Opravená logika currentUser - pro admina vytvoříme virtuální profil
  const currentUser = useMemo(() => {
    if (userRole === 'admin') {
      return {
        id: 'admin-scout',
        nickname: settings.adminProfile?.nickname || 'Admin',
        avatar: settings.adminProfile?.avatar || '⚙️',
        pointsByLevel: {},
        activitiesProgress: {},
        activityCompletionDates: {},
        completedActivities: [],
        unlockedLevels: []
      } as Scout;
    }
    return scouts.find(s => s.id === currentScoutId) || scouts[0];
  }, [userRole, scouts, currentScoutId, settings.adminProfile]);

  const workingActivities = useMemo(() => {
    const list: { activity: Activity, sub: Subcategory }[] = [];
    level.areas.forEach(area => {
      area.subcategories.forEach(sub => {
        sub.activities.forEach(act => {
          const status = currentUser.activitiesProgress[act.id] || 'none';
          if (status === 'working' || status === 'done') {
            list.push({ activity: act, sub });
          }
        });
      });
    });
    return list;
  }, [level, currentUser.activitiesProgress]);

  const getSubProgress = (sub: Subcategory) => {
    const progress = currentUser.activitiesProgress;
    const completed = sub.activities.filter(a => (progress[a.id] || 'none') === 'signed').length;
    const workingCount = sub.activities.filter(a => ['working', 'done'].includes(progress[a.id] || 'none')).length;
    
    const mandatoryTotal = sub.activities.filter(a => a.isMandatory).length;
    const optionalActive = sub.activities.filter(a => !a.isMandatory && (progress[a.id] || 'none') !== 'none').length;

    return { 
      completed, 
      working: workingCount, 
      activeTotal: completed + workingCount, 
      goal: sub.requiredOptionalCount || 0, 
      total: sub.activities.length,
      mandatoryTotal,
      optionalActive
    };
  };

  const getAreaProgress = (area: Area) => {
    let totalGoal = 0;
    let totalCompleted = 0;
    
    area.subcategories.forEach(sub => {
      const prog = getSubProgress(sub);
      totalGoal += prog.goal;
      totalCompleted += Math.min(prog.completed, prog.goal);
    });

    return {
      completed: totalCompleted,
      goal: totalGoal,
      percent: totalGoal > 0 ? Math.round((totalCompleted / totalGoal) * 100) : 0
    };
  };

  const getTotalTrailProgress = () => {
    let totalGoal = 0;
    let totalCompleted = 0;
    let totalPoints = 0;

    level.areas.forEach(area => {
      const prog = getAreaProgress(area);
      totalGoal += prog.goal;
      totalCompleted += prog.completed;
      
      area.subcategories.forEach(sub => {
        sub.activities.forEach(act => {
          if (currentUser.activitiesProgress[act.id] === 'signed') {
            totalPoints += act.pointsValue || (act.isMandatory ? settings.scoring.mandatoryTask : settings.scoring.optionalTask);
          }
        });
      });
    });

    return {
      percent: totalGoal > 0 ? Math.round((totalCompleted / totalGoal) * 100) : 0,
      points: totalPoints,
      completed: totalCompleted,
      goal: totalGoal
    };
  };

  const updateStatus = (activityId: string, status: ActivityStatus, sub: Subcategory) => {
    const currentStatus = currentUser.activitiesProgress[activityId] || 'none';
    
    if (currentStatus === 'signed') {
      alert("Tento úkol je již podepsán vedoucím.");
      return;
    }

    const targetActivity = sub.activities.find(a => a.id === activityId);
    if (!targetActivity) return;

    const isActivating = status !== 'none';
    const wasActive = currentStatus !== 'none';

    if (isActivating && !wasActive) {
      const stats = getSubProgress(sub);
      if (!targetActivity.isMandatory) {
        const maxOptionalAllowed = Math.max(0, stats.goal - stats.mandatoryTotal);
        if (stats.optionalActive >= maxOptionalAllowed) {
          alert(`V sekci "${sub.title}" můžeš plnit maximálně ${maxOptionalAllowed} volitelné úkoly.`);
          setConfirmModal(null);
          return;
        }
      }
    }

    let finalStatus = status;
    if (status === 'working' && currentStatus === 'working') finalStatus = 'none';

    if (finalStatus === 'signed') {
      setJustCompletedId(activityId);
      setTimeout(() => setJustCompletedId(null), 1000);
    }

    const updatedProgress = { ...currentUser.activitiesProgress, [activityId]: finalStatus };

    // Uložíme pouze pokud jde o skutečného uživatele (admin-scout se v poli scouts nenachází)
    if (finalStatus === 'signed') {
       onUpdateScouts(scouts.map(s => s.id === currentUser.id ? { ...currentUser, activitiesProgress: updatedProgress } : s));
       onSignActivity(activityId);
    } else {
      onUpdateScouts(scouts.map(s => s.id === currentUser.id ? { ...s, activitiesProgress: updatedProgress } : s));
    }
    setConfirmModal(null);
  };

  const startScanner = (activityId: string, sub: Subcategory) => {
    const currentStatus = currentUser.activitiesProgress[activityId] || 'none';
    if (currentStatus === 'signed') return;

    setIsScanning(activityId);
    setTimeout(() => {
      const scanner = new (window as any).Html5QrcodeScanner("qr-reader", { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        rememberLastUsedCamera: true
      });
      
      scanner.render((decodedText: string) => {
        if (decodedText.startsWith(leaderSecret)) {
          updateStatus(activityId, 'signed', sub);
          scanner.clear().catch((e: any) => console.error(e));
          setIsScanning(null);
        } else alert('Neplatný podpis!');
      }, () => {});
    }, 200);
  };

  const openPdf = () => {
    if (settings.pdfUrl && settings.pdfUrl.trim() !== "") {
      window.open(settings.pdfUrl, '_blank');
      return;
    }
    const sourceData = PDF_BASE64_DATA ? `data:application/pdf;base64,${PDF_BASE64_DATA}` : "";
    if (!sourceData) {
      alert("Odkaz na PDF není nastaven.");
      return;
    }
    try {
      const parts = sourceData.split(';base64,');
      const base64Data = parts[1];
      const binaryString = window.atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      alert("Chyba při otevírání PDF.");
    }
  };

  const renderActivityCard = (activity: Activity, sub: Subcategory) => {
    const status = currentUser.activitiesProgress[activity.id] || 'none';
    const reward = activity.pointsValue || (activity.isMandatory ? settings.scoring.mandatoryTask : settings.scoring.optionalTask);
    const isSigned = status === 'signed';
    const isDone = status === 'done';
    
    return (
      <div key={activity.id} className={`relative bg-white rounded-[1.5rem] p-4 border-2 transition-all shadow-sm ${activity.isMandatory ? 'border-[#3b5a3b]/30 bg-[#3b5a3b]/5' : 'border-gray-50'} ${isSigned ? 'border-green-500 bg-green-50/40' : ''} ${justCompletedId === activity.id ? 'animate-successPulse' : 'animate-fadeIn'}`}>
        {isSigned && <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 text-6xl opacity-20">✅</div>}
        <div className="flex justify-between items-start mb-2">
          <div className="flex-1">
            <h4 className="font-bold text-gray-800 text-xs leading-tight">{activity.title}</h4>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[7px] font-black text-[#3b5a3b]/50 uppercase">Odměna: {reward} b.</span>
              {activity.isMandatory && <span className="text-[7px] font-black text-red-500 uppercase">● Povinný</span>}
            </div>
          </div>
          <span className={`text-[6px] text-white font-black px-1.5 py-0.5 rounded-full uppercase shrink-0 ${activity.isMandatory ? 'bg-[#3b5a3b]' : 'bg-yellow-400'}`} style={{ backgroundColor: activity.isMandatory ? level.color : '' }}>{activity.isMandatory ? 'P' : 'V'}</span>
        </div>
        <p className="text-[10px] text-gray-500 leading-relaxed mb-4">{activity.description}</p>
        <div className="grid grid-cols-3 gap-1.5 mt-2">
          <button disabled={isSigned} onClick={() => updateStatus(activity.id, 'working', sub)} className={`py-2 rounded-xl text-[7px] font-black uppercase border-2 ${status === 'working' ? 'bg-yellow-400 border-yellow-400 text-white shadow-md' : 'bg-white border-yellow-50 text-yellow-600'}`}>{status === 'working' ? 'Zrušit' : 'Plním'}</button>
          <button disabled={isSigned} onClick={() => { if (status === 'done') updateStatus(activity.id, 'none', sub); else setConfirmModal({ activityId: activity.id, status: 'done', sub }); }} className={`py-2 rounded-xl text-[7px] font-black uppercase border-2 ${isDone ? 'bg-green-500 border-green-500 text-white shadow-md' : 'bg-white border-green-50 text-green-600'}`}>{isDone ? 'Mám!' : 'Hotovo'}</button>
          <button disabled={isSigned} onClick={() => startScanner(activity.id, sub)} className={`py-2 rounded-xl text-[7px] font-black uppercase border-2 bg-white border-gray-50 text-gray-400`}>{isSigned ? '✓ Podpis' : 'Podpis'}</button>
        </div>
      </div>
    );
  };

  if (isScanning) return (
    <div className="fixed inset-0 bg-black z-[100] flex flex-col p-6 text-white animate-fadeIn">
      <div className="flex justify-between items-center mb-10"><h2 className="text-xl font-bold parchment-font">Získej podpis</h2><button onClick={() => setIsScanning(null)} className="p-4 text-2xl">✕</button></div>
      <div id="qr-reader" className="w-full max-w-sm rounded-[3rem] overflow-hidden mx-auto shadow-2xl" />
    </div>
  );

  const totalTrail = getTotalTrailProgress();

  return (
    <div className="p-6 space-y-6 animate-fadeIn pb-32">
      {selectedArea ? (
        <div className="space-y-6">
          <button onClick={() => setSelectedArea(null)} className="font-bold text-sm flex items-center gap-2 active:scale-95 transition-transform" style={{ color: level.color }}>← Zpět na přehled</button>
          <div className="bg-white rounded-[3rem] p-8 border border-gray-100 shadow-sm space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gray-50 rounded-[2rem] flex items-center justify-center text-4xl shadow-inner border border-gray-100">{selectedArea.icon}</div>
              <h2 className="text-2xl font-bold parchment-font" style={{ color: level.color }}>{selectedArea.title}</h2>
            </div>
            <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden shadow-inner">
              <div className="h-full transition-all duration-700 ease-out" style={{ width: `${getAreaProgress(selectedArea).percent}%`, backgroundColor: level.color }} />
            </div>
          </div>
          <div className="space-y-8">
            {selectedArea.subcategories.map((sub, sIdx) => {
              const stats = getSubProgress(sub);
              const isExpanded = expandedSubIdx === sIdx;
              return (
                <div key={sIdx} className="space-y-4">
                  <button onClick={() => setExpandedSubIdx(isExpanded ? null : sIdx)} className="w-full flex items-center justify-between bg-white/40 p-2 rounded-2xl border border-transparent hover:border-gray-100 transition-all">
                    <div className="text-left">
                      <h3 className="text-xs font-black uppercase tracking-widest" style={{ color: level.color }}>{sub.title}</h3>
                      <p className="text-[9px] text-gray-400 font-bold uppercase mt-1">Splněno {stats.completed} z {stats.goal}</p>
                    </div>
                    <span className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} style={{ color: level.color }}>▼</span>
                  </button>
                  {isExpanded && <div className="grid grid-cols-1 gap-3 animate-fadeIn">{sub.activities.map(act => renderActivityCard(act, sub))}</div>}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          <section className="rounded-[3rem] p-8 text-white shadow-xl space-y-6 relative overflow-hidden transition-colors duration-500" style={{ backgroundColor: level.color }}>
             <div className="absolute top-0 right-10 p-10 opacity-10 pointer-events-none text-[10rem] flex items-center justify-center">
                <div className="animate-spin-slow">🧭</div>
             </div>
             <div className="relative z-10">
                <h2 className="text-2xl font-bold parchment-font uppercase tracking-widest">DIGITALIZOVANÁ STEZKA</h2>
                <p className="text-[10px] opacity-60 font-black uppercase tracking-[0.2em] mt-1">Všechny tvé skautské úkoly na jednom místě</p>
                
                <div className="mt-8 flex items-end gap-4">
                   <div className="text-5xl font-black parchment-font">{totalTrail.percent}%</div>
                   <div className="mb-1 text-[10px] font-black uppercase opacity-60">Celkový progres</div>
                </div>

                <div className="mt-4 h-2 w-full bg-white/20 rounded-full overflow-hidden">
                   <div className="h-full bg-white transition-all duration-1000 shadow-[0_0_10px_rgba(255,255,255,0.5)]" style={{ width: `${totalTrail.percent}%` }} />
                </div>

                <div className="mt-8 grid grid-cols-2 gap-4">
                   <div className="bg-white/10 rounded-2xl p-4 border border-white/5 backdrop-blur-sm">
                      <p className="text-[8px] font-black uppercase opacity-60">Nasbírané body</p>
                      <p className="text-xl font-bold">{totalTrail.points} b.</p>
                   </div>
                   <div className="bg-white/10 rounded-2xl p-4 border border-white/5 backdrop-blur-sm">
                      <p className="text-[8px] font-black uppercase opacity-60">Splněno úkolů</p>
                      <p className="text-xl font-bold">{totalTrail.completed} / {totalTrail.goal}</p>
                   </div>
                </div>
             </div>
          </section>

          {workingActivities.length > 0 && (
            <section className="space-y-4 animate-fadeIn">
              <header className="px-2 flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2" style={{ color: level.color }}>
                  <span>⏳</span> Právě plním
                </h3>
                <span className="text-[8px] text-gray-400 font-bold uppercase">{workingActivities.length} čeká na podpis</span>
              </header>
              <div className="grid grid-cols-1 gap-3">
                {workingActivities.map(({ activity, sub }) => renderActivityCard(activity, sub))}
              </div>
            </section>
          )}

          <header className="px-2">
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Kategorie Stezky</h3>
          </header>

          <div className="grid grid-cols-2 gap-4">
            {level.areas.map(area => {
              const progress = getAreaProgress(area);
              return (
                <button 
                  key={area.id} 
                  onClick={() => setSelectedArea(area)} 
                  className="bg-white p-6 rounded-[2.5rem] border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col items-center text-center gap-3 active:scale-95 group"
                >
                  <div className="w-16 h-16 bg-gray-50 rounded-[2rem] flex items-center justify-center text-4xl shadow-inner border border-gray-100 group-hover:scale-110 transition-transform">
                    {area.icon}
                  </div>
                  <h3 className="text-[10px] font-bold text-gray-800 leading-tight uppercase tracking-tight">{area.title}</h3>
                  <div className="w-full mt-2 h-1 bg-gray-50 rounded-full overflow-hidden border border-gray-100">
                    <div className="h-full transition-all duration-500 ease-out" style={{ width: `${progress.percent}%`, backgroundColor: level.color }} />
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-12 mb-8 px-2">
            <button 
              onClick={openPdf}
              className="w-full py-5 bg-white border border-gray-200 rounded-[2rem] shadow-sm flex items-center justify-center gap-4 hover:shadow-md active:scale-95 transition-all group"
            >
              <span className="text-2xl group-hover:scale-110 transition-transform">📄</span>
              <div className="text-left">
                <p className="text-[11px] font-black uppercase tracking-widest" style={{ color: level.color }}>Zobrazit originální sešit</p>
                <p className="text-[9px] text-gray-400 font-bold uppercase">{level.name} (PDF verze)</p>
              </div>
            </button>
          </div>
        </>
      )}

      {confirmModal && (
        <div className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white rounded-[3rem] p-8 w-full max-w-xs space-y-6 animate-fadeIn shadow-2xl">
            <h3 className="text-xl font-bold parchment-font text-center" style={{ color: level.color }}>Máš splněno?</h3>
            <p className="text-[10px] text-gray-400 text-center uppercase font-bold px-4">Úkol se přesune do 'Právě plním' a bude čekat na potvrzení vedoucím.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmModal(null)} className="flex-1 py-4 bg-gray-100 text-gray-500 rounded-2xl font-bold uppercase text-[9px] tracking-widest active:scale-95 transition-all">Ještě ne</button>
              <button onClick={() => updateStatus(confirmModal.activityId, confirmModal.status, confirmModal.sub)} className="flex-1 py-4 text-white rounded-2xl font-bold uppercase text-[9px] tracking-widest shadow-xl active:scale-95 transition-all" style={{ backgroundColor: level.color }}>Ano!</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Stezka;
