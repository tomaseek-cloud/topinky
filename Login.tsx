
import React, { useState } from 'react';
import { Scout, UserRole } from '../types';
import { GreenDiamond } from '../constants';

interface Props {
  scouts: Scout[];
  onLogin: (role: UserRole, scoutId?: string) => void;
  onUpdateScouts: (scouts: Scout[]) => void;
}

const Login: React.FC<Props> = ({ scouts, onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password.trim();

    // Přísná kontrola hardcoded root admina
    if (cleanUser === 'admin' && cleanPass === 'admin') {
      onLogin('admin');
      return;
    }

    // Kontrola skautů podle přezdívky v databázi
    const scout = scouts.find(s => s.nickname.toLowerCase() === cleanUser);
    
    if (scout) {
      if (scout.password === cleanPass) {
        onLogin(scout.role, scout.id);
      } else {
        setError('Nesprávné heslo pro tohoto člena.');
      }
    } else {
      setError('Uživatel s touto přezdívkou nebyl nalezen.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#fcfaf2]">
      <div className="bg-white rounded-[3rem] p-10 shadow-2xl w-full max-w-sm border border-gray-100 space-y-8 animate-fadeIn">
        <div className="text-center space-y-2">
          <div className="w-20 h-20 bg-[#3b5a3b]/5 text-white rounded-[2rem] flex items-center justify-center mx-auto shadow-sm mb-4 border border-[#3b5a3b]/10">
            <GreenDiamond className="w-12 h-12" />
          </div>
          <h2 className="text-2xl font-bold parchment-font text-[#3b5a3b] uppercase tracking-widest">TopTopinkiAPP</h2>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Digitální skautská stezka</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 pl-4">Přezdívka člena / Admin</label>
            <input 
              type="text" 
              className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-2 ring-[#3b5a3b]/20 font-bold text-sm text-black placeholder-gray-300"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Zadej svou přezdívku"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 pl-4">Heslo</label>
            <input 
              type="password" 
              className="w-full p-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:ring-2 ring-[#3b5a3b]/20 font-bold text-sm text-black placeholder-gray-300"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Zadej heslo"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 rounded-xl border border-red-100">
              <p className="text-[10px] text-red-500 font-bold text-center uppercase tracking-wider">{error}</p>
            </div>
          )}

          <button 
            type="submit" 
            className="w-full py-4 bg-[#3b5a3b] text-white rounded-[1.5rem] font-black uppercase text-xs tracking-[0.2em] shadow-xl hover:bg-[#2d452d] hover:scale-[1.02] active:scale-[0.98] transition-all mt-4"
          >
            Vstoupit do aplikace
          </button>
        </form>

        <div className="pt-6 border-t border-gray-50 text-center space-y-4">
          <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest italic">
            Nápověda k přihlášení
          </p>
          <div className="text-[8px] text-gray-300 leading-relaxed text-left space-y-1">
             <p>• Pro vstup použij svou <b>přezdívku</b> a své heslo.</p>
             <p>• Pokud ses ještě nepřihlašoval, tvé heslo je <b>1234</b>.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
