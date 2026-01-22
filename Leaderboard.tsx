
import React, { useState, useMemo } from 'react';
import { Scout, AppSettings, Game, Area } from '../types';
import { GreenDiamond } from '../constants';

interface Props {
  scouts: Scout[];
  levelId: string;
  settings: AppSettings;
  games: Game[];
  areas: Area[];
}

const Leaderboard: React.FC<Props> = ({ scouts, levelId, settings, games, areas }) => {
  const [period, setPeriod] = useState<'30days' | 'total'>('30days');

  const calculatePoints = useMemo(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));

    // Filtrujeme pouze skutečné skauty (děti), admina ignorujeme
    const filterScouts = scouts.filter(s => s.id !== 'admin-scout');

    return filterScouts.map(scout => {
      let totalPts = scout.pointsByLevel[levelId] || 0;
      let thirtyDayPts = 0;

      // 1. Úkoly (Activities)
      areas.forEach(area => {
        area.subcategories.forEach(sub => {
          sub.activities.forEach(act => {
            if (scout.activitiesProgress[act.id] === 'signed') {
              const dateStr = scout.activityCompletionDates[act.id];
              const pts = act.pointsValue || (act.isMandatory ? settings.scoring.mandatoryTask : settings.scoring.optionalTask);
              if (dateStr && new Date(dateStr) >= thirtyDaysAgo) {
                thirtyDayPts += pts;
              }
            }
          });
        });
      });

      // 2. Bonusy
      (settings.bonuses || []).forEach(bonus => {
        if (bonus.scoutId === scout.id && bonus.levelId === levelId) {
          if (new Date(bonus.date) >= thirtyDaysAgo) {
            thirtyDayPts += bonus.points;
          }
        }
      });

      // 3. Hry
      games.forEach(game => {
        if (game.levelId !== levelId) return;
        
        const meeting = settings.meetings.find(m => m.id === game.meetingId);
        if (!meeting || new Date(meeting.date) < thirtyDaysAgo) return;

        const indResult = game.results.find(r => r.scoutId === scout.id);
        if (indResult) thirtyDayPts += indResult.pointsGained;

        if (game.gameType === 'team') {
          const team = meeting.teams?.find(t => t.members.includes(scout.id));
          if (team) {
            const teamResult = game.results.find(r => r.teamId === team.name);
            if (teamResult) thirtyDayPts += teamResult.pointsGained;
          }
        }
      });

      // 4. Docházka
      settings.meetings.forEach(meeting => {
        if (new Date(meeting.date) < thirtyDaysAgo) return;
        const status = meeting.attendance?.[scout.id];
        if (!status) return;

        let pts = 0;
        if (status === 'present') pts = settings.scoring.attendancePresent;
        else if (status === 'late') pts = settings.scoring.attendanceLate;
        else if (status === 'excused') pts = settings.scoring.attendanceExcused;
        
        thirtyDayPts += pts;
      });

      return {
        ...scout,
        calculatedTotal: totalPts,
        calculated30: thirtyDayPts
      };
    });
  }, [scouts, levelId, settings, games, areas]);

  const displayScouts = useMemo(() => {
    return [...calculatePoints].sort((a, b) => {
      const valA = period === '30days' ? a.calculated30 : a.calculatedTotal;
      const valB = period === '30days' ? b.calculated30 : b.calculatedTotal;
      return valB - valA;
    });
  }, [calculatePoints, period]);

  const showTotalOption = settings.showTotalLeaderboard;

  return (
    <div className="p-6 space-y-8 pb-32">
      <header className="text-center space-y-4">
        <h2 className="text-3xl parchment-font font-bold text-[#3b5a3b]">Leaderboard</h2>
        
        {showTotalOption && (
          <div className="flex bg-gray-100 p-1 rounded-2xl border max-w-xs mx-auto">
            <button 
              onClick={() => setPeriod('30days')}
              className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${period === '30days' ? 'bg-white shadow-sm text-[#3b5a3b]' : 'text-gray-400'}`}
            >
              Posledních 30 dní
            </button>
            <button 
              onClick={() => setPeriod('total')}
              className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${period === 'total' ? 'bg-white shadow-sm text-[#3b5a3b]' : 'text-gray-400'}`}
            >
              Celkově
            </button>
          </div>
        )}
        
        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
          {period === '30days' ? 'Aktivita za poslední měsíc' : 'Síň slávy - Celkové skóre'}
        </p>
      </header>

      <div className="flex items-end justify-center gap-2 py-8 animate-fadeIn">
        {displayScouts[1] && (
          <div className="flex flex-col items-center gap-2">
            <div className="w-16 h-16 rounded-full bg-gray-200 border-4 border-white shadow-lg flex items-center justify-center text-2xl">🥈</div>
            <div className="bg-white border border-gray-100 w-24 h-24 rounded-t-2xl flex flex-col items-center justify-center shadow-sm">
              <span className="text-[10px] font-bold text-gray-400 uppercase">2. místo</span>
              <span className="text-xs font-bold truncate w-full px-2 text-center">{displayScouts[1].nickname}</span>
              <span className="text-lg font-bold text-[#3b5a3b]">
                {period === '30days' ? displayScouts[1].calculated30 : displayScouts[1].calculatedTotal}
              </span>
            </div>
          </div>
        )}
        {displayScouts[0] && (
          <div className="flex flex-col items-center gap-2">
            <div className="w-20 h-20 rounded-full bg-yellow-400 border-4 border-white shadow-xl flex items-center justify-center text-3xl">👑</div>
            <div className="bg-[#3b5a3b] w-28 h-32 rounded-t-2xl flex flex-col items-center justify-center shadow-lg text-white">
              <span className="text-[10px] font-bold text-yellow-300 uppercase tracking-widest">Šampion</span>
              <span className="text-sm font-bold truncate w-full px-2 text-center">{displayScouts[0].nickname}</span>
              <span className="text-2xl font-bold">
                {period === '30days' ? displayScouts[0].calculated30 : displayScouts[0].calculatedTotal}
              </span>
            </div>
          </div>
        )}
        {displayScouts[2] && (
          <div className="flex flex-col items-center gap-2">
            <div className="w-14 h-14 rounded-full bg-orange-200 border-4 border-white shadow-lg flex items-center justify-center text-xl">🥉</div>
            <div className="bg-white border border-gray-100 w-22 h-20 rounded-t-2xl flex flex-col items-center justify-center shadow-sm">
              <span className="text-[10px] font-bold text-gray-400 uppercase">3. místo</span>
              <span className="text-xs font-bold truncate w-full px-2 text-center">{displayScouts[2].nickname}</span>
              <span className="text-lg font-bold text-[#3b5a3b]">
                {period === '30days' ? displayScouts[2].calculated30 : displayScouts[2].calculatedTotal}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
        {displayScouts.map((scout, idx) => {
          const score = period === '30days' ? scout.calculated30 : scout.calculatedTotal;
          return (
            <div key={scout.id} className={`flex items-center gap-4 p-4 border-b border-gray-50 last:border-0 ${idx < 3 ? 'bg-[#3b5a3b]/5' : ''}`}>
              <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${idx === 0 ? 'bg-yellow-400 text-white' : idx === 1 ? 'bg-gray-200 text-gray-600' : idx === 2 ? 'bg-orange-200 text-orange-800' : 'text-gray-400 bg-gray-50'}`}>{idx + 1}</span>
              <div className="flex-1">
                <h4 className="font-bold text-gray-800 text-sm">{scout.nickname}</h4>
              </div>
              <div className="text-right">
                <span className="text-lg font-bold text-[#3b5a3b]">{score}</span>
                <span className="text-[9px] text-gray-400 block uppercase font-bold">bodů</span>
              </div>
            </div>
          );
        })}
      </div>

      <section className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm space-y-6">
         <header className="flex items-center gap-2 border-b border-gray-50 pb-4">
            <span className="text-xl">📊</span>
            <h3 className="text-sm font-black text-[#3b5a3b] uppercase tracking-widest">Pravidla hodnocení</h3>
         </header>
         <div className="grid grid-cols-2 gap-4">
            {[
              { label: 'Povinný úkol', points: settings.scoring.mandatoryTask, icon: '🔴' },
              { label: 'Volitelný úkol', points: settings.scoring.optionalTask, icon: '🟡' },
              { label: 'Účast (přítomen)', points: settings.scoring.attendancePresent, icon: '📅' },
              { label: 'Účast (pozdě)', points: settings.scoring.attendanceLate, icon: '⏰' },
              { label: 'Omluvenka', points: settings.scoring.attendanceExcused, icon: '📝' },
              { label: 'Hry a bonusy', points: '?', icon: <GreenDiamond className="w-5 h-5" /> }
            ].map(item => (
              <div key={item.label} className="bg-gray-50/50 p-3 rounded-2xl border border-gray-100 flex items-center gap-3">
                 <span className="text-lg flex items-center justify-center">{item.icon}</span>
                 <div>
                    <p className="text-[9px] font-black text-gray-400 uppercase leading-none mb-1">{item.label}</p>
                    <p className="text-xs font-bold text-[#3b5a3b]">{item.points} bodů</p>
                 </div>
              </div>
            ))}
         </div>
      </section>
    </div>
  );
};

export default Leaderboard;
