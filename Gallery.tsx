
import React, { useState, useMemo } from 'react';
// Fix: Added UserRole to imports
import { AppSettings, Meeting, Article, Scout, UserRole } from '../types';

interface Props {
  settings: AppSettings;
  // Fix: Changed 'admin' | 'user' | null to UserRole | null
  userRole: UserRole | null;
  currentScoutId: string | null;
  scouts: Scout[];
  onUpdateSettings: (settings: AppSettings) => void;
}

const Gallery: React.FC<Props> = ({ settings, userRole, currentScoutId, scouts, onUpdateSettings }) => {
  const [editorState, setEditorState] = useState<{ meetingId: string, articleId?: string } | null>(null);
  const [articleContent, setArticleContent] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<{ meetingId: string, articleId: string } | null>(null);
  
  const currentUser = scouts.find(s => s.id === currentScoutId);
  const CHAR_LIMIT = 5000;

  const pastMeetings = useMemo(() => 
    settings.meetings
      .filter(m => new Date(m.date) <= new Date())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  , [settings.meetings]);

  const handleOpenEditor = (meetingId: string, article?: Article) => {
    setEditorState({ meetingId, articleId: article?.id });
    setArticleContent(article?.content || "");
  };

  const handleSaveArticle = () => {
    if (!editorState) return;
    
    const { meetingId, articleId } = editorState;
    
    // Použijeme přezdívku z adminProfile pokud jsme admin
    const authorName = userRole === 'admin' 
      ? (settings.adminProfile?.nickname || 'Administrátor')
      : (currentUser?.nickname || 'Neznámý');
      
    const authorId = userRole === 'admin' ? 'admin-scout' : (currentScoutId || 'anonym');

    if (articleContent.length > CHAR_LIMIT) {
      alert(`Text je příliš dlouhý! Máš ${articleContent.length} znaků, limit je ${CHAR_LIMIT}.`);
      return;
    }

    if (articleContent.trim().length < 5) {
      alert("Zápis je příliš krátký. Zkus se trochu víc rozepsat!");
      return;
    }

    const updatedMeetings = settings.meetings.map(m => {
      if (m.id === meetingId) {
        let updatedArticles = [...(m.articles || [])];
        
        if (articleId) {
          // Edit existing
          updatedArticles = updatedArticles.map(a => 
            a.id === articleId ? { ...a, content: articleContent.trim(), timestamp: new Date().toISOString() } : a
          );
        } else {
          // Create new
          const newArticle: Article = {
            id: Date.now().toString(),
            scoutId: authorId,
            scoutNickname: authorName,
            content: articleContent.trim(),
            timestamp: new Date().toISOString()
          };
          updatedArticles.push(newArticle);
        }
        
        return { ...m, articles: updatedArticles };
      }
      return m;
    });

    onUpdateSettings({ ...settings, meetings: updatedMeetings });
    setEditorState(null);
    setArticleContent("");
  };

  const confirmDelete = () => {
    if (!deleteConfirm) return;
    const { meetingId, articleId } = deleteConfirm;

    const updatedMeetings = settings.meetings.map(m => {
      if (m.id === meetingId) {
        return {
          ...m,
          articles: (m.articles || []).filter(a => a.id !== articleId)
        };
      }
      return m;
    });

    onUpdateSettings({ ...settings, meetings: updatedMeetings });
    setDeleteConfirm(null);
  };

  return (
    <div className="p-6 space-y-12 animate-fadeIn pb-32 text-black">
      <header className="text-center space-y-2">
        <h2 className="text-3xl font-bold parchment-font text-[#3b5a3b]">Kronika výprav</h2>
        <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest leading-relaxed">Příběhy a vzpomínky z našich cest</p>
      </header>

      {pastMeetings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 opacity-40">
           <span className="text-6xl">📸</span>
           <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Zatím jsme nic nepodnikli...</p>
        </div>
      ) : (
        <div className="space-y-8">
          {pastMeetings.map(meeting => (
            <section key={meeting.id} className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden transition-all hover:shadow-md flex flex-col">
              <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-50">
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-[#3b5a3b] uppercase tracking-[0.2em]">
                    {new Date(meeting.date).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                  <h3 className="text-lg font-bold text-gray-800 leading-tight">
                    {meeting.notes || 'Společná akce'}
                  </h3>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button 
                    onClick={() => handleOpenEditor(meeting.id)}
                    className="inline-flex items-center gap-2 bg-gray-50 text-gray-500 hover:text-[#3b5a3b] px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border border-gray-100 active:scale-95"
                  >
                    Napsat do kroniky ✍️
                  </button>
                  {meeting.albumUrl && (
                    <a 
                      href={meeting.albumUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 bg-[#3b5a3b] text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg hover:bg-[#2d452d] active:scale-95 transition-all"
                    >
                      Fotoalbum ↗
                    </a>
                  )}
                </div>
              </div>

              {/* Articles Display */}
              <div className="p-6 space-y-6 bg-gray-50/30">
                {!meeting.articles || meeting.articles.length === 0 ? (
                  <p className="text-[10px] text-gray-300 font-bold uppercase tracking-widest text-center py-4 italic">Zatím žádný zápis v kronice...</p>
                ) : (
                  <div className="grid gap-4">
                    {meeting.articles.map(article => (
                      <div key={article.id} className="relative bg-white p-5 rounded-3xl border border-gray-100 shadow-sm animate-fadeIn group">
                        <div className="absolute -top-3 -left-1 text-4xl text-[#3b5a3b]/10 font-serif">“</div>
                        <p className="text-sm text-gray-700 leading-relaxed relative z-10 whitespace-pre-wrap italic">
                          {article.content}
                        </p>
                        <div className="mt-4 pt-3 border-t border-gray-50 flex justify-between items-center">
                          <div className="flex items-center gap-2">
                             <span className="text-[10px] font-black text-[#3b5a3b] uppercase tracking-widest">— {article.scoutNickname}</span>
                             <span className="text-[8px] text-gray-300 font-bold uppercase">{new Date(article.timestamp).toLocaleDateString('cs-CZ')}</span>
                          </div>
                          {(userRole === 'admin' || (currentScoutId && currentScoutId === article.scoutId)) && (
                            <div className="flex gap-2">
                              <button 
                                onClick={() => handleOpenEditor(meeting.id, article)}
                                className="p-1.5 bg-gray-50 text-gray-400 hover:text-[#3b5a3b] rounded-lg transition-all"
                                title="Upravit zápis"
                              >
                                ✏️
                              </button>
                              <button 
                                onClick={() => setDeleteConfirm({ meetingId: meeting.id, articleId: article.id })}
                                className="p-1.5 bg-red-50 text-red-500 hover:bg-red-100 rounded-lg transition-all"
                                title="Smazat zápis"
                              >
                                🗑️
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Editor Modal */}
      {editorState && (
        <div className="fixed inset-0 z-[600] bg-black/60 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-white rounded-[3rem] p-8 w-full max-w-lg space-y-6 shadow-2xl animate-fadeIn flex flex-col max-h-[85vh]">
            <div className="text-center">
              <h3 className="text-xl font-bold text-[#3b5a3b] parchment-font uppercase tracking-widest">
                {editorState.articleId ? "Upravit zápis" : "Nový zápis do kroniky"}
              </h3>
              <p className="text-[10px] text-gray-400 font-bold uppercase mt-1">Autor: {userRole === 'admin' ? (settings.adminProfile?.nickname || 'Admin') : (currentUser?.nickname || 'Neznámý')}</p>
            </div>
            
            <div className="flex-1 min-h-0 relative">
              <textarea 
                className="w-full h-full min-h-[300px] p-6 bg-gray-50 border-2 border-gray-100 rounded-[2rem] outline-none focus:border-[#3b5a3b] focus:bg-white transition-all text-sm font-medium leading-relaxed text-gray-900 scrollbar-hide resize-none shadow-inner"
                placeholder="Jaká byla výprava? Co se ti nejvíc líbilo? Napiš nám o tom..."
                value={articleContent}
                onChange={(e) => setArticleContent(e.target.value)}
                autoFocus
              />
              <div className={`absolute bottom-4 right-6 text-[10px] font-black uppercase tracking-widest ${articleContent.length > CHAR_LIMIT ? 'text-red-500' : 'text-gray-400'}`}>
                {articleContent.length} / {CHAR_LIMIT} znaků
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => {
                  setEditorState(null);
                  setArticleContent("");
                }} 
                className="flex-1 py-4 bg-gray-100 text-gray-500 rounded-2xl font-black uppercase text-[10px] tracking-widest active:scale-95 transition-all"
              >
                Zrušit
              </button>
              <button 
                onClick={handleSaveArticle}
                disabled={articleContent.trim().length === 0 || articleContent.length > CHAR_LIMIT}
                className="flex-1 py-4 bg-[#3b5a3b] text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all disabled:opacity-30"
              >
                Uložit zápis
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-[700] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-[3rem] p-10 max-sm w-full shadow-2xl text-center space-y-4">
            <h3 className="text-2xl font-bold parchment-font text-red-500">Smazat zápis?</h3>
            <p className="text-sm text-gray-500">Opravdu chceš tento zápis z kroniky odstranit?</p>
            <div className="flex gap-4 mt-8">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-4 bg-gray-100 rounded-2xl font-bold uppercase text-[10px] tracking-widest active:scale-95 transition-all">Zrušit</button>
              <button onClick={confirmDelete} className="flex-1 py-4 bg-red-500 text-white rounded-2xl font-bold uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all">Smazat</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Gallery;
