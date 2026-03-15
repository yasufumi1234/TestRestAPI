// アプリケーションのエントリーポイント
// React アプリを DOM にマウントする

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css'; // Tailwind CSS / shadcn/ui のグローバルスタイル

// HTML の #root 要素に React アプリをマウントする
// StrictMode: 開発時に潜在的な問題を検出するためのラッパー
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
