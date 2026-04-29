import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import Login from './Login.jsx';
import './index.css';

function Root() {
  const [authed, setAuthed] = useState(!!sessionStorage.getItem('xul_auth'));
  if (!authed) return <Login onLogin={() => setAuthed(true)} />;
  return <App />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)
