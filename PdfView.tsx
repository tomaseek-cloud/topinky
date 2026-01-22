
import React, { useState, useEffect } from 'react';
import { AppSettings } from '../types';
import { PDF_BASE64_DATA } from '../pdfData';

interface Props {
  settings: AppSettings;
}

const PdfView: React.FC<Props> = ({ settings }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [blobUrl, setBlobUrl] = useState<string>("");
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const sourceData = settings.pdfUrl || (PDF_BASE64_DATA ? `data:application/pdf;base64,${PDF_BASE64_DATA}` : "");

    if (sourceData && sourceData.startsWith('data:application/pdf')) {
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
        
        setBlobUrl(url);
        setHasError(false);
      } catch (error) {
        console.error("PDF Processing Error:", error);
        setHasError(true);
      }
    } else if (sourceData && sourceData.startsWith('blob:')) {
      setBlobUrl(sourceData);
    }
    
    const timer = setTimeout(() => setIsLoading(false), 800);

    return () => {
      if (blobUrl && blobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(blobUrl);
      }
      clearTimeout(timer);
    };
  }, [settings.pdfUrl]);

  const openInNewTab = () => {
    if (blobUrl) {
      window.open(blobUrl, '_blank');
    }
  };

  const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);

  return (
    <div className="flex flex-col animate-fadeIn bg-white h-full overflow-hidden">
      <div className="flex-1 relative bg-gray-50 flex flex-col overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#fcfaf2] z-[20] space-y-4">
            <div className="w-12 h-12 border-4 border-[#3b5a3b]/10 border-t-[#3b5a3b] rounded-full animate-spin"></div>
            <p className="text-[10px] font-black text-[#3b5a3b] uppercase tracking-[0.2em] animate-pulse">Načítám stezku...</p>
          </div>
        )}

        <div className="flex-1 flex flex-col h-full relative overflow-hidden bg-white">
          {blobUrl && !hasError ? (
            <div className="flex-1 flex flex-col h-full relative">
              {isChrome && (
                <div className="p-2 bg-yellow-50 border-b border-yellow-100 flex items-center justify-between shrink-0">
                  <span className="text-[8px] font-bold text-yellow-700 uppercase pl-2">⚠️ Chrome může blokovat náhled</span>
                  <button onClick={openInNewTab} className="px-2 py-1 bg-yellow-600 text-white text-[7px] font-black uppercase rounded-lg">Otevřít přímo</button>
                </div>
              )}
              
              <div className="absolute top-4 right-4 z-[15] pointer-events-auto">
                <button 
                  onClick={openInNewTab}
                  className="bg-[#3b5a3b] text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-2xl border-2 border-white/20 active:scale-95 transition-transform"
                >
                  Otevřít samostatně ↗
                </button>
              </div>

              <object
                data={blobUrl}
                type="application/pdf"
                className="w-full h-full border-none"
                aria-label="Skautská Stezka PDF"
              >
                 <div className="flex flex-col items-center justify-center h-full p-10 text-center space-y-4">
                    <p className="text-xs text-gray-500 font-bold">Prohlížeč zablokoval náhled PDF.</p>
                    <button onClick={openInNewTab} className="py-4 px-8 bg-[#3b5a3b] text-white rounded-2xl font-black text-[10px] uppercase shadow-xl">Zobrazit stezku</button>
                 </div>
              </object>
            </div>
          ) : !isLoading && (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-4 bg-white">
              <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center text-3xl shadow-inner grayscale opacity-40">📄</div>
              <h3 className="text-sm font-bold text-gray-800">
                {hasError ? "Chyba při čtení PDF" : "Žádný soubor stezky"}
              </h3>
              <p className="text-[10px] text-gray-400">Vedoucí zatím nenahrál PDF verzi.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PdfView;
