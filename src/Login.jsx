import { useState, useEffect } from 'react';

const AUTH_USER = import.meta.env.VITE_AUTH_USER || 'victorgarcia@xul.es';
const AUTH_PASS = import.meta.env.VITE_AUTH_PASS || 'Xul2026';

export default function Login({ onLogin }) {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    document.body.classList.add('xul-login-body');
    return () => document.body.classList.remove('xul-login-body');
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (user.trim() === AUTH_USER && pass === AUTH_PASS) {
      sessionStorage.setItem('xul_auth', '1');
      onLogin();
    } else {
      setError('Usuario o contraseña incorrectos.');
    }
  };

  return (
    <>
      <style>{`
        .xul-login-body {
          background: #0A0A0B !important;
          font-family: 'Plus Jakarta Sans', 'Inter', sans-serif !important;
        }
        .login-screen {
          position: fixed;
          inset: 0;
          display: grid;
          place-items: center;
          background: #0A0A0B;
          z-index: 1000;
          overflow: hidden;
        }
        .login-bg-blob {
          position: absolute;
          width: 500px;
          height: 500px;
          background: radial-gradient(circle, rgba(122,63,175,0.14) 0%, transparent 70%);
          filter: blur(80px);
          z-index: 0;
          animation: loginFloat 20s infinite alternate ease-in-out;
        }
        @keyframes loginFloat {
          0%   { transform: translate(-20%, -20%) scale(1); }
          100% { transform: translate(20%, 20%) scale(1.2); }
        }
        .login-card {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 400px;
          background: #141418;
          border: 1px solid #222228;
          border-radius: 24px;
          padding: 40px;
          box-shadow: 0 20px 50px rgba(0,0,0,0.4);
          text-align: center;
          backdrop-filter: blur(10px);
          animation: loginSlideUp 0.6s cubic-bezier(0.16,1,0.3,1);
        }
        @keyframes loginSlideUp {
          from { transform: translateY(20px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        .login-brand {
          margin-bottom: 32px;
        }
        .login-brand-name {
          font-size: 28px;
          font-weight: 800;
          letter-spacing: -0.04em;
          color: #EDEDEE;
          font-family: 'Plus Jakarta Sans', sans-serif;
        }
        .login-brand-sub {
          font-size: 12px;
          color: #6C6C74;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-top: 4px;
        }
        .login-header {
          margin-bottom: 32px;
        }
        .login-header h1 {
          font-size: 20px;
          font-weight: 600;
          letter-spacing: -0.03em;
          color: #EDEDEE;
          margin-bottom: 6px;
          font-family: 'Plus Jakarta Sans', sans-serif;
        }
        .login-header p {
          color: #A1A1A8;
          font-size: 14px;
        }
        .login-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
          text-align: left;
        }
        .login-input-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .login-input-group label {
          font-size: 12px;
          font-weight: 600;
          color: #A1A1A8;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-left: 4px;
        }
        .login-input {
          background: #161619;
          border: 1px solid #222228;
          border-radius: 12px;
          padding: 12px 16px;
          font-size: 15px;
          color: #EDEDEE;
          transition: all 0.2s;
          outline: none;
          font-family: inherit;
        }
        .login-input:focus {
          border-color: #7A3FAF;
          background: #0A0A0B;
          box-shadow: 0 0 0 4px rgba(122,63,175,0.25);
        }
        .login-error {
          color: #E8473D;
          font-size: 13px;
          text-align: center;
          margin: 0;
        }
        .login-submit {
          background: #7A3FAF;
          color: white;
          border: none;
          border-radius: 12px;
          padding: 14px;
          font-size: 15px;
          font-weight: 600;
          cursor: pointer;
          margin-top: 8px;
          transition: all 0.2s;
          font-family: inherit;
        }
        .login-submit:hover {
          background: #5B2A86;
          transform: translateY(-1px);
        }
        .login-submit:active {
          transform: translateY(0);
        }
        .login-footer {
          margin-top: 32px;
          font-size: 12px;
          color: #6C6C74;
        }
      `}</style>

      <div className="login-screen">
        <div className="login-bg-blob" />
        <div className="login-card">
          <div className="login-brand">
            <div className="login-brand-name">XUL</div>
            <div className="login-brand-sub">Monitor de Medios</div>
          </div>
          <div className="login-header">
            <h1>Bienvenido</h1>
            <p>Introduce tus credenciales para acceder.</p>
          </div>
          <form className="login-form" onSubmit={handleSubmit}>
            <div className="login-input-group">
              <label>Usuario</label>
              <input
                type="text"
                className="login-input"
                placeholder="usuario@xul.es"
                value={user}
                onChange={e => { setUser(e.target.value); setError(''); }}
                required
                autoFocus
              />
            </div>
            <div className="login-input-group">
              <label>Contraseña</label>
              <input
                type="password"
                className="login-input"
                placeholder="••••••••"
                value={pass}
                onChange={e => { setPass(e.target.value); setError(''); }}
                required
              />
            </div>
            {error && <p className="login-error">{error}</p>}
            <button type="submit" className="login-submit">Acceder al Panel</button>
          </form>
          <div className="login-footer">XUL · © 2026</div>
        </div>
      </div>
    </>
  );
}
