import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App.jsx';
import { LangProvider } from './i18n.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(<LangProvider><HashRouter><App /></HashRouter></LangProvider>);
