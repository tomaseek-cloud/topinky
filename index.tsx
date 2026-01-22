
import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen font-bold text-[#3b5a3b] parchment-font text-2xl">Načítání stezky...</div>}>
      <App />
    </Suspense>
  </React.StrictMode>
);
