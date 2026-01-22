
import React, { useState, useEffect, useRef } from 'react';
import { AppSettings, Scout, FlappyScore, DailyPlayTime } from '../types';

interface Props {
  settings: AppSettings;
  onUpdateSettings: (s: AppSettings) => void;
  currentScout: Scout;
}

const CANVAS_WIDTH = 320;
const CANVAS_HEIGHT = 480;
const GRAVITY = 0.25;
const JUMP = -4.5;
const PIPE_WIDTH = 50;
const PIPE_GAP = 150;
const PIPE_SPEED = 2;
const MAX_PLAY_TIME_SECONDS = 300; // 5 minut

const GameView: React.FC<Props> = ({ settings, onUpdateSettings, currentScout }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'IDLE' | 'COUNTDOWN' | 'PLAYING' | 'GAMEOVER' | 'LIMIT_EXCEEDED'>('IDLE');
  const [scoreUI, setScoreUI] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [dailyPlaySeconds, setDailyPlaySeconds] = useState(0);

  // Herní proměnné v refu pro zamezení re-renderu a řešení stale closures
  const scoreRef = useRef(0);
  const birdY = useRef(200);
  const birdVelocity = useRef(0);
  const pipes = useRef<{ x: number; top: number; passed: boolean }[]>([]);
  const frameId = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  // Inicializace a kontrola limitu
  useEffect(() => {
    if (!currentScout?.id) return;
    
    const todayStr = new Date().toISOString().split('T')[0];
    const userPlayTime = settings.playTimes.find(pt => pt.scoutId === currentScout.id && pt.date === todayStr);
    const initialSeconds = userPlayTime ? userPlayTime.seconds : 0;
    setDailyPlaySeconds(initialSeconds);
    
    if (initialSeconds >= MAX_PLAY_TIME_SECONDS && currentScout.id !== 'admin-scout') {
      setGameState('LIMIT_EXCEEDED');
    }
  }, [currentScout?.id, settings.playTimes]);

  // Hlavní herní smyčka
  const gameLoop = (timestamp: number) => {
    if (!lastTimeRef.current) lastTimeRef.current = timestamp;
    const deltaTime = timestamp - lastTimeRef.current;
    lastTimeRef.current = timestamp;

    if (gameState === 'PLAYING') {
      // Aktualizace limitu (pouze pokud hrajeme a nejsme admin)
      setDailyPlaySeconds(prev => {
        const newSeconds = prev + (deltaTime / 1000);
        if (newSeconds >= MAX_PLAY_TIME_SECONDS && currentScout?.id !== 'admin-scout') {
          setGameState('LIMIT_EXCEEDED');
          updateStoredPlayTime(newSeconds);
        }
        return newSeconds;
      });

      updatePhysics();
    }
    draw();
    frameId.current = requestAnimationFrame(gameLoop);
  };

  const updatePhysics = () => {
    // Gravitace
    birdVelocity.current += GRAVITY;
    birdY.current += birdVelocity.current;

    // Trubky (Stromy / Stany)
    if (pipes.current.length === 0 || pipes.current[pipes.current.length - 1].x < CANVAS_WIDTH - 200) {
      pipes.current.push({
        x: CANVAS_WIDTH,
        top: 50 + Math.random() * (CANVAS_HEIGHT - PIPE_GAP - 100),
        passed: false
      });
    }

    pipes.current.forEach(pipe => {
      pipe.x -= PIPE_SPEED;

      // Kolize
      const birdRect = { x: 50, y: birdY.current, w: 34, h: 34 };
      if (
        birdRect.x + birdRect.w > pipe.x &&
        birdRect.x < pipe.x + PIPE_WIDTH &&
        (birdRect.y < pipe.top || birdRect.y + birdRect.h > pipe.top + PIPE_GAP)
      ) {
        endGame();
      }

      // Skóre - používáme ref pro okamžitou hodnotu
      if (!pipe.passed && pipe.x < 50) {
        pipe.passed = true;
        scoreRef.current += 1;
        setScoreUI(scoreRef.current); // Sync s UI
      }
    });

    // Podlaha a strop
    if (birdY.current > CANVAS_HEIGHT - 34 || birdY.current < 0) {
      endGame();
    }

    // Odstranění starých trubek
    pipes.current = pipes.current.filter(p => p.x > -PIPE_WIDTH);
  };

  const draw = () => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    // Pozadí
    ctx.fillStyle = '#ebf5eb';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Trávy (jednoduché)
    ctx.fillStyle = '#3b5a3b';
    ctx.fillRect(0, CANVAS_HEIGHT - 20, CANVAS_WIDTH, 20);

    // Překážky (Stromy a Stany)
    pipes.current.forEach(pipe => {
      // Horní překážka (Strom)
      ctx.fillStyle = '#2d452d';
      ctx.beginPath();
      ctx.moveTo(pipe.x, pipe.top);
      ctx.lineTo(pipe.x + PIPE_WIDTH/2, pipe.top - 150);
      ctx.lineTo(pipe.x + PIPE_WIDTH, pipe.top);
      ctx.fill();
      ctx.fillRect(pipe.x + PIPE_WIDTH/2 - 5, pipe.top - 20, 10, 20);

      // Spodní překážka (Stan)
      ctx.fillStyle = '#8b572a';
      const bottomY = pipe.top + PIPE_GAP;
      ctx.fillRect(pipe.x, bottomY, PIPE_WIDTH, CANVAS_HEIGHT - bottomY);
      ctx.fillStyle = '#a67c52';
      ctx.beginPath();
      ctx.moveTo(pipe.x, bottomY);
      ctx.lineTo(pipe.x + PIPE_WIDTH/2, bottomY + 40);
      ctx.lineTo(pipe.x + PIPE_WIDTH, bottomY);
      ctx.fill();
    });

    // Topinka (Toast)
    if (gameState !== 'IDLE' && gameState !== 'LIMIT_EXCEEDED') {
      ctx.save();
      ctx.translate(50 + 17, birdY.current + 17);
      ctx.rotate(Math.min(Math.PI / 4, Math.max(-Math.PI / 4, birdVelocity.current * 0.1)));
      
      // Tělo toustu
      ctx.fillStyle = '#d9a66d';
      ctx.beginPath();
      ctx.roundRect(-17, -17, 34, 34, 5);
      ctx.fill();
      ctx.strokeStyle = '#8b572a';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Obličej
      ctx.fillStyle = '#3b5a3b';
      ctx.fillRect(-8, -8, 4, 4);
      ctx.fillRect(4, -8, 4, 4);
      ctx.beginPath();
      ctx.arc(0, 4, 6, 0, Math.PI);
      ctx.stroke();

      ctx.restore();
    }

    // Toustovač (v klidovém stavu)
    if (gameState === 'IDLE' || gameState === 'COUNTDOWN') {
      ctx.fillStyle = '#999';
      ctx.roundRect(40, CANVAS_HEIGHT - 80, 60, 60, 10);
      ctx.fill();
      ctx.fillStyle = '#333';
      ctx.fillRect(45, CANVAS_HEIGHT - 75, 50, 5);
    }
  };

  const updateStoredPlayTime = (seconds: number) => {
    if (!currentScout?.id) return;
    const todayStr = new Date().toISOString().split('T')[0];
    const newPlayTimes = [...settings.playTimes];
    const index = newPlayTimes.findIndex(pt => pt.scoutId === currentScout.id && pt.date === todayStr);
    
    if (index >= 0) {
      newPlayTimes[index] = { ...newPlayTimes[index], seconds };
    } else {
      newPlayTimes.push({ scoutId: currentScout.id, date: todayStr, seconds });
    }
    
    onUpdateSettings({ ...settings, playTimes: newPlayTimes });
  };

  const startCountdown = () => {
    if (dailyPlaySeconds >= MAX_PLAY_TIME_SECONDS && currentScout?.id !== 'admin-scout') return;
    setGameState('COUNTDOWN');
    setCountdown(3);
    pipes.current = [];
    birdY.current = CANVAS_HEIGHT - 100;
    birdVelocity.current = -10; // "Výstřel" z toustovače
    scoreRef.current = 0;
    setScoreUI(0);
  };

  useEffect(() => {
    if (gameState === 'COUNTDOWN') {
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            setGameState('PLAYING');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [gameState]);

  useEffect(() => {
    frameId.current = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(frameId.current);
  }, [gameState]);

  const handleAction = () => {
    if (gameState === 'PLAYING') {
      birdVelocity.current = JUMP;
    } else if (gameState === 'IDLE' || gameState === 'GAMEOVER') {
      startCountdown();
    }
  };

  const endGame = () => {
    if (gameState !== 'PLAYING') return;
    setGameState('GAMEOVER');
    updateStoredPlayTime(dailyPlaySeconds);
    
    // Uložení skóre - bereme hodnotu přímo z refu, aby nebyla nula
    const finalScore = scoreRef.current;
    
    const newScore: FlappyScore = {
      nickname: currentScout?.nickname || 'Neznámý',
      score: finalScore,
      date: new Date().toLocaleDateString('cs-CZ')
    };
    
    // Seřazení a uložení nejlepších výsledků
    const newScores = [newScore, ...settings.flappyScores]
      .sort((a, b) => b.score - a.score)
      .slice(0, 10); // Interně držíme víc pro jistotu, ale UI omezíme na 5

    onUpdateSettings({ ...settings, flappyScores: newScores });
  };

  const progressPercent = Math.min(100, (dailyPlaySeconds / MAX_PLAY_TIME_SECONDS) * 100);

  // Žebříček se zobrazuje jen když se aktivně nehraje
  const showLeaderboard = gameState === 'IDLE' || gameState === 'GAMEOVER' || gameState === 'LIMIT_EXCEEDED';

  return (
    <div className="flex flex-col items-center p-6 space-y-6 animate-fadeIn pb-32">
      <header className="text-center space-y-2">
        <h2 className="text-3xl font-bold parchment-font text-[#3b5a3b]">Flappy Toast</h2>
        <div className="flex items-center gap-2 justify-center">
          <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden border border-gray-100">
             <div className="h-full bg-orange-400 transition-all" style={{ width: `${progressPercent}%` }}></div>
          </div>
          <span className="text-[8px] font-black uppercase text-gray-400">Energie: {currentScout?.id === 'admin-scout' ? '∞' : `${Math.max(0, Math.floor((MAX_PLAY_TIME_SECONDS - dailyPlaySeconds) / 60))} min`} zbývá</span>
        </div>
      </header>

      <div 
        className="relative shadow-2xl rounded-[3rem] overflow-hidden border-[10px] border-white cursor-pointer transition-all"
        onClick={handleAction}
        style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}
      >
        <canvas 
          ref={canvasRef} 
          width={CANVAS_WIDTH} 
          height={CANVAS_HEIGHT}
          className="bg-white"
        />

        {gameState === 'IDLE' && (
          <div className="absolute inset-0 bg-[#3b5a3b]/20 backdrop-blur-sm flex flex-col items-center justify-center text-center p-8 space-y-4">
             <div className="text-6xl animate-bounce">🍞</div>
             <h3 className="text-2xl font-bold parchment-font text-white drop-shadow-lg">Letící topinka</h3>
             <p className="text-[10px] text-white font-black uppercase tracking-widest bg-[#3b5a3b] px-4 py-2 rounded-full">Klikni pro start</p>
          </div>
        )}

        {gameState === 'COUNTDOWN' && (
          <div className="absolute inset-0 flex items-center justify-center">
             <span className="text-8xl font-black text-[#3b5a3b] animate-ping">{countdown}</span>
          </div>
        )}

        {gameState === 'PLAYING' && (
          <div className="absolute top-8 left-0 right-0 text-center">
             <span className="text-6xl font-black text-[#3b5a3b] drop-shadow-md">{scoreUI}</span>
          </div>
        )}

        {gameState === 'GAMEOVER' && (
          <div className="absolute inset-0 bg-red-500/30 backdrop-blur-md flex flex-col items-center justify-center text-center p-8 space-y-4">
             <h3 className="text-4xl font-black text-white drop-shadow-lg">BUM!</h3>
             <div className="bg-white p-6 rounded-[2rem] shadow-xl space-y-1">
                <p className="text-[9px] font-black text-gray-400 uppercase">Tvé skóre</p>
                <p className="text-5xl font-black text-[#3b5a3b]">{scoreUI}</p>
             </div>
             <button onClick={startCountdown} className="px-8 py-4 bg-white text-[#3b5a3b] rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl">Hrát znovu</button>
          </div>
        )}

        {gameState === 'LIMIT_EXCEEDED' && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xl flex flex-col items-center justify-center text-center p-10 space-y-6">
             <div className="text-6xl">😴</div>
             <div className="space-y-2">
                <h3 className="text-xl font-bold text-white parchment-font">Už dost toustování!</h3>
                <p className="text-xs text-gray-300">Sorry, denní limit 5 minut byl vyčerpán. Přijď zase zítra!</p>
             </div>
          </div>
        )}
      </div>

      {showLeaderboard && (
        <section className="w-full max-w-sm bg-white rounded-[3rem] p-8 border border-gray-100 shadow-sm space-y-6 animate-fadeIn">
           <header className="flex items-center justify-between border-b border-gray-50 pb-4">
              <h3 className="text-sm font-black text-[#3b5a3b] uppercase tracking-widest">🏆 Nejlepší skóre</h3>
              <span className="text-[8px] text-gray-400 font-bold uppercase">Top 5</span>
           </header>
           
           <div className="space-y-3">
              {settings.flappyScores.length === 0 ? (
                <p className="text-center text-[10px] text-gray-400 py-4">Zatím nikdo neletěl...</p>
              ) : (
                settings.flappyScores.slice(0, 5).map((s, i) => (
                  <div key={i} className="flex items-center justify-between group animate-fadeIn" style={{ animationDelay: `${i * 0.1}s` }}>
                     <div className="flex items-center gap-3">
                        <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black ${i === 0 ? 'bg-yellow-400 text-white' : 'bg-gray-50 text-gray-400'}`}>
                          {i + 1}
                        </span>
                        <div>
                          <p className="text-xs font-bold text-gray-800">{s.nickname}</p>
                          <p className="text-[7px] text-gray-400 uppercase font-black">{s.date}</p>
                        </div>
                     </div>
                     <div className="text-right">
                        <span className="text-sm font-black text-[#3b5a3b]">{s.score}</span>
                     </div>
                  </div>
                ))
              )}
           </div>
        </section>
      )}
    </div>
  );
};

export default GameView;
